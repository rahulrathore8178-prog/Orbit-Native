import { authStorage } from '@/lib/auth/authStorage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState, DeviceEventEmitter, PermissionsAndroid, Platform, Vibration } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import {
    MediaStream,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    mediaDevices,
} from 'react-native-webrtc';
import { getDeviceId } from './deviceId';
import { CallPeer, CallState, CallType, IDLE_CALL } from './types';

/*
 * HOW IT WORKS
 *  - REST  (/api/calls)   : state changes (start / accept / reject / end)
 *  - WebSocket            : realtime events from the server + the WebRTC handshake
 *  - WebRTC               : the actual audio/video, peer to peer (TURN relay if needed)
 *
 *  The CALLER creates the offer (with a pre-negotiated audio + video m-line), the CALLEE answers
 *  and adopts the video transceiver from the offer. "Switch to video" is just replaceTrack().
 */

type Props = { apiUrl: string; userId?: string | null; children: React.ReactNode };

export type AudioRoute = 'EARPIECE' | 'SPEAKER_PHONE' | 'WIRED_HEADSET' | 'BLUETOOTH';
const DEFAULT_ROUTES: AudioRoute[] = ['EARPIECE', 'SPEAKER_PHONE'];

type CallContextValue = {
    state: CallState;
    /** realtime socket is registered, calls can be placed */
    isReady: boolean;
    startCall: (peer: CallPeer, type: CallType) => Promise<void>;
    acceptCall: () => Promise<void>;
    rejectCall: () => Promise<void>;
    endCall: () => Promise<void>;
    toggleMute: () => void;
    toggleSpeaker: () => void;
    toggleCamera: () => Promise<void>;
    audioDevices: AudioRoute[];
    audioRoute: AudioRoute;
    setAudioRoute: (route: AudioRoute) => Promise<void>;
};

type RtpSender = { replaceTrack: (track: any) => Promise<void> };

const CallContext = createContext<CallContextValue | null>(null);

export const useCall = () => {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
    return ctx;
};

const END_SCREEN_MS = 1800;
const RECONNECT_FAIL_MS = 15000;
const RING_SAFETY_MS = 4000;

const START_ERRORS: Record<string, string> = {
    CALLEE_OFFLINE: 'Unavailable right now',
    CALLEE_BUSY: 'On another call',
    ALREADY_IN_CALL: 'You are already in a call',
    RATE_LIMITED: 'Too many calls, try again soon',
    SOCKET_NOT_CONNECTED: 'Connecting… try again in a moment',
    CALL_UNAVAILABLE: "Can't call this user",
    INVALID_RECIPIENT: "Can't call this user",
    USER_NOT_FOUND: "Can't call this user",
};

const toWsUrl = (u: string) => u.replace(/^http/i, 'ws').replace(/\/+$/, '');

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const endedLabel = (
    msg: { status?: string; reason?: string; durationSec?: number },
    direction: 'outgoing' | 'incoming'
): { label: string; tone: 'neutral' | 'bad' } => {
    const out = direction === 'outgoing';
    switch (msg.status) {
        case 'rejected':
            return out ? { label: 'Call declined', tone: 'bad' } : { label: 'Call ended', tone: 'neutral' };
        case 'missed':
            return out ? { label: 'No answer', tone: 'bad' } : { label: 'Missed call', tone: 'neutral' };
        case 'cancelled':
            return out ? { label: 'Call cancelled', tone: 'neutral' } : { label: 'Missed call', tone: 'neutral' };
        case 'ended':
            if (msg.reason === 'disconnected') return { label: 'Connection lost', tone: 'bad' };
            return {
                label: `Call ended${msg.durationSec ? ` · ${fmtDuration(msg.durationSec)}` : ''}`,
                tone: 'neutral',
            };
        default:
            return { label: 'Call failed', tone: 'bad' };
    }
};

export function CallProvider({ apiUrl, userId, children }: Props) {
    const [state, setState] = useState<CallState>(IDLE_CALL);
    const [isReady, setIsReady] = useState(false);

    // Always-current mirrors, so socket / WebRTC callbacks never read stale state.
    const stateRef = useRef<CallState>(IDLE_CALL);
    const isReadyRef = useRef(false);
    const apiUrlRef = useRef(apiUrl);
    apiUrlRef.current = apiUrl;

    const wsRef = useRef<WebSocket | null>(null);
    const deviceIdRef = useRef<string | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const camStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const videoSenderRef = useRef<RtpSender | null>(null);
    const iceServersRef = useRef<any[]>([]);
    const pendingIceRef = useRef<any[]>([]);
    const earlySignalsRef = useRef<{ type: string; data: any }[]>([]);

    const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelRequestedRef = useRef(false);
    const restartedRef = useRef(false);

    const update = useCallback((patch: Partial<CallState>) => {
        stateRef.current = { ...stateRef.current, ...patch };
        setState(stateRef.current);
    }, []);

    /* ---------------- audio routing (speaker / earpiece / wired / bluetooth) ---------------- */

    const [audio, setAudio] = useState<{ devices: AudioRoute[]; selected: AudioRoute }>({
        devices: DEFAULT_ROUTES,
        selected: 'EARPIECE',
    });
    const audioRef = useRef(audio);
    audioRef.current = audio;

    const hasHeadset = useCallback(
        () => audioRef.current.selected === 'BLUETOOTH' || audioRef.current.selected === 'WIRED_HEADSET',
        []
    );

    const setAudioRoute = useCallback(
        async (route: AudioRoute) => {
            const m = InCallManager as any;
            try {
                if (typeof m.chooseAudioRoute === 'function') await m.chooseAudioRoute(route);
                else m.setForceSpeakerphoneOn(route === 'SPEAKER_PHONE' ? true : null);
            } catch (e) {
                console.log('Audio route failed:', (e as any)?.message ?? e);
            }
            setAudio((a) => ({ ...a, selected: route }));
            if (stateRef.current.phase !== 'idle') update({ isSpeaker: route === 'SPEAKER_PHONE' });
            Haptics.selectionAsync();
        },
        [update]
    );

    // device list pushed by the native module (plug / unplug / bluetooth connect)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('onAudioDeviceChanged', (e: any) => {
            let list: AudioRoute[] = [];
            try {
                const raw = e?.availableAudioDeviceList;
                list = typeof raw === 'string' ? JSON.parse(raw) : raw ?? [];
            } catch {
                /* ignore */
            }
            const selected = (e?.selectedAudioDevice || 'EARPIECE') as AudioRoute;
            setAudio({ devices: list.length ? list : DEFAULT_ROUTES, selected });
            if (stateRef.current.phase !== 'idle') update({ isSpeaker: selected === 'SPEAKER_PHONE' });
        });
        return () => sub.remove();
    }, [update]);

    /* ---------------- REST + signaling helpers ---------------- */

    const post = useCallback(async (path: string, body: object = {}) => {
        const token = await authStorage.getToken();
        return axios.post(`${apiUrlRef.current}/api/calls${path}`, body, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            timeout: 15000,
        });
    }, []);

    const sendSignal = useCallback((type: string, data: object) => {
        const ws = wsRef.current;
        const callId = stateRef.current.callId;
        if (!ws || ws.readyState !== WebSocket.OPEN || !callId) return false;
        ws.send(JSON.stringify({ type, callId, data }));
        return true;
    }, []);

    /* ---------------- teardown / finish ---------------- */

    const clearTimers = useCallback(() => {
        if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        if (failTimerRef.current) clearTimeout(failTimerRef.current);
        ringTimerRef.current = null;
        failTimerRef.current = null;
    }, []);

    const teardownMedia = useCallback(() => {
        clearTimers();
        try {
            pcRef.current?.close();
        } catch {
            /* already closed */
        }
        pcRef.current = null;
        [micStreamRef, camStreamRef].forEach((ref) => {
            ref.current?.getTracks().forEach((t) => {
                try {
                    t.stop();
                } catch {
                    /* already stopped */
                }
            });
            ref.current = null;
        });
        remoteStreamRef.current = null;
        videoSenderRef.current = null;
        pendingIceRef.current = [];
        earlySignalsRef.current = [];
        restartedRef.current = false;
        Vibration.cancel();
        try {
            InCallManager.stopRingtone();
            InCallManager.stopRingback();
            InCallManager.stop();
        } catch {
            /* native module not ready */
        }
        setAudio({ devices: DEFAULT_ROUTES, selected: 'EARPIECE' });
    }, [clearTimers]);

    /** Go straight back to idle with no summary screen (e.g. answered on another device). */
    const dismiss = useCallback(() => {
        teardownMedia();
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        stateRef.current = IDLE_CALL;
        setState(IDLE_CALL);
    }, [teardownMedia]);

    /** Show a short summary ("Call declined") and then return to idle. */
    const finish = useCallback(
        (label: string, tone: 'neutral' | 'bad' = 'neutral') => {
            teardownMedia();
            if (stateRef.current.phase === 'idle') return;
            update({
                phase: 'ended',
                endLabel: label,
                endTone: tone,
                callId: null,
                isCameraOn: false,
                localVideoURL: null,
                remoteVideoURL: null,
                peerVideoOn: false,
                networkWeak: false,
            });
            if (endTimerRef.current) clearTimeout(endTimerRef.current);
            endTimerRef.current = setTimeout(() => {
                stateRef.current = IDLE_CALL;
                setState(IDLE_CALL);
            }, END_SCREEN_MS);
        },
        [teardownMedia, update]
    );

    const hangup = useCallback(
        (label: string, tone: 'neutral' | 'bad' = 'neutral') => {
            const id = stateRef.current.callId;
            finish(label, tone);
            if (id) post(`/${id}/end`).catch(() => { });
        },
        [finish, post]
    );

    const armRingTimer = useCallback(
        (ms: number, label: string) => {
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
            ringTimerRef.current = setTimeout(() => {
                const p = stateRef.current.phase;
                if (p === 'outgoing' || p === 'incoming') finish(label, 'neutral');
            }, ms + RING_SAFETY_MS);
        },
        [finish]
    );

    /* ---------------- media ---------------- */

    const acquireMic = useCallback(async () => {
        if (Platform.OS === 'android') {
            const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('MIC_DENIED');
            // Android 12+: needed to route call audio to bluetooth headsets / earbuds
            if (Number(Platform.Version) >= 31) {
                await PermissionsAndroid.request('android.permission.BLUETOOTH_CONNECT' as any).catch(() => null);
            }
        }
        const stream = (await mediaDevices.getUserMedia({ audio: true, video: false })) as MediaStream;
        micStreamRef.current = stream;
    }, []);

    const enableCamera = useCallback(async () => {
        const sender = videoSenderRef.current;
        if (!pcRef.current || !sender || stateRef.current.isCameraOn) return;
        try {
            if (Platform.OS === 'android') {
                const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
                if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('CAM_DENIED');
            }
            const cam = (await mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: 640, height: 480, frameRate: 24 },
            })) as MediaStream;
            if (!pcRef.current) {
                // the call ended while the camera was starting
                cam.getTracks().forEach((t) => t.stop());
                return;
            }
            camStreamRef.current = cam;
            await sender.replaceTrack(cam.getVideoTracks()[0]);

            // Only go to speaker if no headset is connected (never steal audio from earbuds),
            // and only touch routing when it actually changes -> no audio blip.
            const speaker = stateRef.current.isSpeaker || !hasHeadset();
            if (speaker && !stateRef.current.isSpeaker) {
                try {
                    InCallManager.setForceSpeakerphoneOn(true);
                } catch {
                    /* ignore */
                }
            }
            update({ isCameraOn: true, localVideoURL: cam.toURL(), isSpeaker: speaker });
            sendSignal('call-meta', { video: true });
        } catch (e) {
            console.log('Camera could not start:', (e as any)?.message ?? e);
        }
    }, [hasHeadset, sendSignal, update]);

    const disableCamera = useCallback(async () => {
        try {
            await videoSenderRef.current?.replaceTrack(null);
        } catch {
            /* ignore */
        }
        camStreamRef.current?.getTracks().forEach((t) => t.stop());
        camStreamRef.current = null;
        update({ isCameraOn: false, localVideoURL: null });
        sendSignal('call-meta', { video: false });
    }, [sendSignal, update]);

    /* ---------------- WebRTC ---------------- */

    const requestIceRestart = useCallback(async () => {
        const pc = pcRef.current;
        if (!pc) return;
        if (stateRef.current.direction === 'outgoing') {
            // only the caller creates offers
            if (restartedRef.current) return;
            restartedRef.current = true;
            try {
                const offer = await pc.createOffer({ iceRestart: true } as any);
                await pc.setLocalDescription(offer);
                sendSignal('call-offer', { type: offer.type, sdp: offer.sdp });
            } catch (e) {
                console.log('ICE restart failed:', (e as any)?.message ?? e);
            }
        } else {
            sendSignal('call-meta', { restart: true });
        }
    }, [sendSignal]);

    const onIceState = useCallback(
        (s: string) => {
            const cur = stateRef.current;
            if (s === 'connected' || s === 'completed') {
                if (failTimerRef.current) clearTimeout(failTimerRef.current);
                failTimerRef.current = null;
                restartedRef.current = false;
                if (cur.phase === 'connecting') {
                    const speaker = cur.callType === 'video' && !hasHeadset();
                    try {
                        InCallManager.stopRingback();
                        // null = default routing, which lets wired / bluetooth headsets take over
                        InCallManager.setForceSpeakerphoneOn(speaker ? true : (null as any));
                    } catch {
                        /* ignore */
                    }
                    update({ phase: 'active', connectedAt: Date.now(), networkWeak: false, isSpeaker: speaker });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    if (cur.callType === 'video') enableCamera();
                } else if (cur.networkWeak) {
                    update({ networkWeak: false });
                }
                return;
            }
            if (s === 'disconnected' || s === 'failed') {
                if (cur.phase === 'active') update({ networkWeak: true });
                if (!failTimerRef.current) {
                    failTimerRef.current = setTimeout(() => {
                        failTimerRef.current = null;
                        const p = stateRef.current.phase;
                        if (p === 'connecting' || (p === 'active' && stateRef.current.networkWeak)) {
                            hangup('Connection lost', 'bad');
                        }
                    }, RECONNECT_FAIL_MS);
                }
                if (s === 'failed') requestIceRestart();
            }
        },
        [enableCamera, hangup, hasHeadset, requestIceRestart, update]
    );

    const createPeer = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: iceServersRef.current,
            bundlePolicy: 'max-bundle',
        } as any);
        pcRef.current = pc;

        const remote = new MediaStream();
        remoteStreamRef.current = remote;

        const mic = micStreamRef.current;
        mic?.getTracks().forEach((t) => pc.addTrack(t, mic));

        // CALLER only: pre-negotiate a video m-line (no track yet). Turning the camera on later is
        // replaceTrack(). The CALLEE must NOT add its own transceiver: it adopts the one from the
        // offer in handleOffer, otherwise its video is sent on an unmatched m-line and the caller
        // never receives it.
        if (stateRef.current.direction === 'outgoing') {
            const videoTransceiver = (pc as any).addTransceiver('video', { direction: 'sendrecv' });
            videoSenderRef.current = videoTransceiver.sender as RtpSender;
        }

        (pc as any).addEventListener('icecandidate', (e: any) => {
            const c = e.candidate;
            if (c) sendSignal('call-ice', { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex });
        });
        (pc as any).addEventListener('track', (e: any) => {
            remote.addTrack(e.track);
            if (e.track.kind === 'video') {
                update({ remoteVideoURL: remote.toURL(), remoteVersion: stateRef.current.remoteVersion + 1 });
            }
        });
        (pc as any).addEventListener('iceconnectionstatechange', () => onIceState((pc as any).iceConnectionState));
        return pc;
    }, [onIceState, sendSignal, update]);

    const flushIce = useCallback(async () => {
        const pc = pcRef.current;
        if (!pc) return;
        const list = pendingIceRef.current;
        pendingIceRef.current = [];
        for (const c of list) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {
                /* a stale candidate is harmless */
            }
        }
    }, []);

    const handleOffer = useCallback(
        async (desc: any) => {
            const pc = pcRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(desc));

                // CALLEE: adopt the video transceiver created from the caller's offer and make it
                // send as well, so the caller can see our camera.
                if (!videoSenderRef.current) {
                    const vt = (pc as any)
                        .getTransceivers?.()
                        .find((t: any) => t.receiver?.track?.kind === 'video');
                    if (vt) {
                        try {
                            vt.direction = 'sendrecv';
                        } catch {
                            /* ignore */
                        }
                        videoSenderRef.current = vt.sender as RtpSender;
                    }
                }

                await flushIce();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal('call-answer', { type: answer.type, sdp: answer.sdp });
            } catch (e) {
                console.log('Handling offer failed:', (e as any)?.message ?? e);
                hangup('Call failed', 'bad');
            }
        },
        [flushIce, hangup, sendSignal]
    );

    const handleAnswer = useCallback(
        async (desc: any) => {
            const pc = pcRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(desc));
                await flushIce();
            } catch (e) {
                console.log('Handling answer failed:', (e as any)?.message ?? e);
                hangup('Call failed', 'bad');
            }
        },
        [flushIce, hangup]
    );

    const routeSignal = useCallback(
        (type: string, data: any) => {
            const pc = pcRef.current;

            // The callee's peer connection is created after the accept request returns,
            // but the offer can arrive before that. Hold early signals until it exists.
            if (!pc && (type === 'call-offer' || type === 'call-ice')) {
                earlySignalsRef.current.push({ type, data });
                return;
            }

            switch (type) {
                case 'call-offer':
                    handleOffer(data);
                    break;
                case 'call-answer':
                    handleAnswer(data);
                    break;
                case 'call-ice':
                    if (!pc || !pc.remoteDescription) pendingIceRef.current.push(data);
                    else pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => { });
                    break;
                case 'call-meta':
                    if (typeof data?.muted === 'boolean') update({ peerMuted: data.muted });
                    if (typeof data?.video === 'boolean') update({ peerVideoOn: data.video });
                    if (data?.restart && stateRef.current.direction === 'outgoing') {
                        restartedRef.current = false;
                        requestIceRestart();
                    }
                    break;
            }
        },
        [handleAnswer, handleOffer, requestIceRestart, update]
    );

    /** Caller side: the callee accepted, so build the connection and send the offer. */
    const beginAsCaller = useCallback(async () => {
        try {
            InCallManager.stopRingback();
        } catch {
            /* ignore */
        }
        if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        update({ phase: 'connecting' });
        try {
            const pc = createPeer();
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true } as any);
            await pc.setLocalDescription(offer);
            sendSignal('call-offer', { type: offer.type, sdp: offer.sdp });
        } catch (e) {
            console.log('Creating offer failed:', (e as any)?.message ?? e);
            hangup('Call failed', 'bad');
        }
    }, [createPeer, hangup, sendSignal, update]);

    /* ---------------- public actions ---------------- */

    const startCall = useCallback(
        async (peer: CallPeer, type: CallType) => {
            const cur = stateRef.current;
            if (cur.phase !== 'idle' && cur.phase !== 'ended') return;
            if (endTimerRef.current) clearTimeout(endTimerRef.current);

            cancelRequestedRef.current = false;
            stateRef.current = {
                ...IDLE_CALL,
                phase: 'outgoing',
                direction: 'outgoing',
                callType: type,
                peer,
                isSpeaker: type === 'video',
            };
            setState(stateRef.current);

            if (!isReadyRef.current) {
                finish('Connecting… try again in a moment', 'bad');
                return;
            }

            try {
                InCallManager.start({ media: type === 'video' ? 'video' : 'audio', ringback: '_DTMF_' } as any);
            } catch {
                /* ignore */
            }

            try {
                await acquireMic();
                const deviceId = deviceIdRef.current ?? (await getDeviceId());
                const { data } = await post('', { recipientId: peer.id, type, deviceId });
                const callId: string = data.call.callId;
                iceServersRef.current = data.iceServers ?? [];

                if (cancelRequestedRef.current) {
                    // the user hung up while the request was still in flight
                    cancelRequestedRef.current = false;
                    post(`/${callId}/end`).catch(() => { });
                    return;
                }
                update({ callId });
                armRingTimer(data.call.ringTimeoutMs ?? 45000, 'No answer');
            } catch (e: any) {
                if (cancelRequestedRef.current) {
                    cancelRequestedRef.current = false;
                    return;
                }
                const label =
                    e?.message === 'MIC_DENIED'
                        ? 'Microphone access is needed'
                        : START_ERRORS[e?.response?.data?.code] ?? "Couldn't place the call";
                finish(label, 'bad');
            }
        },
        [acquireMic, armRingTimer, finish, post, update]
    );

    const acceptCall = useCallback(async () => {
        const cur = stateRef.current;
        if (cur.phase !== 'incoming' || !cur.callId) return;
        const id = cur.callId;

        Vibration.cancel();
        try {
            InCallManager.stopRingtone();
            InCallManager.start({ media: cur.callType === 'video' ? 'video' : 'audio' });
        } catch {
            /* ignore */
        }
        if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        update({ phase: 'connecting', isSpeaker: cur.callType === 'video' });

        try {
            await acquireMic();
        } catch {
            post(`/${id}/reject`).catch(() => { });
            finish('Microphone access is needed', 'bad');
            return;
        }

        try {
            const deviceId = deviceIdRef.current ?? (await getDeviceId());
            const { data } = await post(`/${id}/accept`, { deviceId });

            // the caller may have cancelled while we were asking for permission
            if (stateRef.current.callId !== id || stateRef.current.phase !== 'connecting') return;

            iceServersRef.current = data.iceServers ?? [];
            createPeer();
            const queued = earlySignalsRef.current;
            earlySignalsRef.current = [];
            queued.forEach((s) => routeSignal(s.type, s.data));
        } catch (e: any) {
            const code = e?.response?.data?.code;
            if (code === 'CALL_NOT_FOUND' || code === 'CALL_NOT_RINGING') finish('Call no longer available', 'neutral');
            else finish("Couldn't connect the call", 'bad');
        }
    }, [acquireMic, createPeer, finish, post, routeSignal, update]);

    const rejectCall = useCallback(async () => {
        const cur = stateRef.current;
        if (cur.phase !== 'incoming' || !cur.callId) return;
        const id = cur.callId;
        dismiss();
        post(`/${id}/reject`).catch(() => { });
    }, [dismiss, post]);

    const endCall = useCallback(async () => {
        const cur = stateRef.current;
        if (cur.phase === 'idle' || cur.phase === 'ended') return;
        if (cur.phase === 'incoming') return rejectCall();

        if (!cur.callId) {
            // still placing the call: finish locally, startCall cancels it once the request returns
            cancelRequestedRef.current = true;
            finish('Call cancelled');
            return;
        }
        const label =
            cur.phase === 'outgoing'
                ? 'Call cancelled'
                : `Call ended${cur.connectedAt ? ` · ${fmtDuration(Math.round((Date.now() - cur.connectedAt) / 1000))}` : ''}`;
        hangup(label);
    }, [finish, hangup, rejectCall]);

    const toggleMute = useCallback(() => {
        const next = !stateRef.current.isMuted;
        micStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = !next;
        });
        update({ isMuted: next });
        sendSignal('call-meta', { muted: next });
        Haptics.selectionAsync();
    }, [sendSignal, update]);

    /** Speaker on/off. Turning it off goes to the best connected device (bluetooth > wired > phone). */
    const toggleSpeaker = useCallback(() => {
        const a = audioRef.current;
        if (stateRef.current.isSpeaker) {
            setAudioRoute(
                a.devices.includes('BLUETOOTH')
                    ? 'BLUETOOTH'
                    : a.devices.includes('WIRED_HEADSET')
                        ? 'WIRED_HEADSET'
                        : 'EARPIECE'
            );
        } else {
            setAudioRoute('SPEAKER_PHONE');
        }
    }, [setAudioRoute]);

    const toggleCamera = useCallback(async () => {
        if (stateRef.current.phase !== 'active') return;
        if (stateRef.current.isCameraOn) await disableCamera();
        else await enableCamera();
    }, [disableCamera, enableCamera]);

    /* ---------------- server events ---------------- */

    const onMessage = (msg: any) => {
        const cur = stateRef.current;

        switch (msg.type) {
            case 'call-incoming': {
                // Already in a call (or a replay of the call we are already ringing for): ignore.
                if (cur.phase !== 'idle' && cur.phase !== 'ended') return;
                if (endTimerRef.current) clearTimeout(endTimerRef.current);
                const c = msg.call;
                stateRef.current = {
                    ...IDLE_CALL,
                    phase: 'incoming',
                    direction: 'incoming',
                    callId: c.callId,
                    callType: c.type,
                    peer: c.caller,
                };
                setState(stateRef.current);
                try {
                    InCallManager.startRingtone('_DEFAULT_');
                } catch {
                    /* ignore */
                }
                Vibration.vibrate([0, 700, 1000], true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                armRingTimer(c.ringTimeoutMs ?? 45000, 'Missed call');
                return;
            }

            case 'call-handled':
                // answered on another device of mine
                if (cur.phase === 'incoming' && cur.callId === msg.callId) dismiss();
                return;

            case 'call-accepted':
                if (cur.callId === msg.callId && cur.direction === 'outgoing' && cur.phase === 'outgoing') beginAsCaller();
                return;

            case 'call-offer':
            case 'call-answer':
            case 'call-ice':
            case 'call-meta':
                if (msg.callId === cur.callId) routeSignal(msg.type, msg.data);
                return;

            case 'call-ended': {
                if (msg.callId !== cur.callId) return;
                const { label, tone } = endedLabel(msg, cur.direction);
                finish(label, tone);
                return;
            }

            case 'call-error':
                console.log('Call signaling error:', msg.code, msg.message);
                return;
        }
    };
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    /* ---------------- realtime socket ---------------- */

    useEffect(() => {
        if (!userId) {
            isReadyRef.current = false;
            setIsReady(false);
            if (stateRef.current.phase !== 'idle') dismiss();
            return;
        }

        let closed = false;
        let retry = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const connect = async () => {
            if (closed) return;
            if (!deviceIdRef.current) deviceIdRef.current = await getDeviceId();
            const token = await authStorage.getToken();
            if (closed) return;

            const ws = new WebSocket(toWsUrl(apiUrlRef.current));
            wsRef.current = ws;

            ws.onopen = () => {
                if (wsRef.current !== ws) return;
                ws.send(JSON.stringify({ type: 'register', userId, token, deviceId: deviceIdRef.current }));
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(String(ev.data));
                    if (msg.type === 'registered') {
                        retry = 0;
                        isReadyRef.current = true;
                        setIsReady(true);
                        return;
                    }
                    onMessageRef.current(msg);
                } catch (e) {
                    console.log('Call socket message error:', (e as any)?.message ?? e);
                }
            };

            ws.onerror = () => { };

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null;
                    isReadyRef.current = false;
                    setIsReady(false);
                }
                if (closed) return;
                const delay = Math.min(1000 * 2 ** retry, 10000);
                retry += 1;
                timer = setTimeout(connect, delay);
            };
        };

        connect();

        // Coming back to the app: reconnect right away instead of waiting out the backoff.
        const sub = AppState.addEventListener('change', (st) => {
            if (st !== 'active' || closed) return;
            const ws = wsRef.current;
            if (!ws || ws.readyState > WebSocket.OPEN) {
                if (timer) clearTimeout(timer);
                retry = 0;
                connect();
            }
        });

        return () => {
            closed = true;
            if (timer) clearTimeout(timer);
            sub.remove();
            const ws = wsRef.current;
            wsRef.current = null;
            ws?.close();
            isReadyRef.current = false;
            setIsReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => () => teardownMedia(), [teardownMedia]);

    const value = useMemo<CallContextValue>(
        () => ({
            state,
            isReady,
            startCall,
            acceptCall,
            rejectCall,
            endCall,
            toggleMute,
            toggleSpeaker,
            toggleCamera,
            audioDevices: audio.devices,
            audioRoute: audio.selected,
            setAudioRoute,
        }),
        [
            state,
            isReady,
            startCall,
            acceptCall,
            rejectCall,
            endCall,
            toggleMute,
            toggleSpeaker,
            toggleCamera,
            audio,
            setAudioRoute,
        ]
    );

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}