export type CallType = 'audio' | 'video';

/**
 * idle        no call
 * outgoing    I called, waiting for them to answer
 * incoming    someone is calling me
 * connecting  answered, media is being negotiated
 * active      audio/video flowing
 * ended       short summary screen ("Call declined", "No answer", ...) before going back to idle
 */
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export type CallPeer = { id: string; username: string; profilePic?: string };

export type CallState = {
    phase: CallPhase;
    callId: string | null;
    direction: 'outgoing' | 'incoming';
    callType: CallType;
    peer: CallPeer | null;
    connectedAt: number | null;
    isMuted: boolean;
    isSpeaker: boolean;
    isCameraOn: boolean;
    peerMuted: boolean;
    peerVideoOn: boolean;
    networkWeak: boolean;
    localVideoURL: string | null;
    remoteVideoURL: string | null;
    /** bumps when the remote video track changes so RTCView re-mounts cleanly */
    remoteVersion: number;
    endLabel: string | null;
    endTone: 'neutral' | 'bad';
};

export const IDLE_CALL: CallState = {
    phase: 'idle',
    callId: null,
    direction: 'outgoing',
    callType: 'audio',
    peer: null,
    connectedAt: null,
    isMuted: false,
    isSpeaker: false,
    isCameraOn: false,
    peerMuted: false,
    peerVideoOn: false,
    networkWeak: false,
    localVideoURL: null,
    remoteVideoURL: null,
    remoteVersion: 0,
    endLabel: null,
    endTone: 'neutral',
};