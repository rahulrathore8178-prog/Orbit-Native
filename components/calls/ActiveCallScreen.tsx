import { useCall } from '@/lib/calls/callProvider';
import { setMinimized } from '@/lib/calls/callUI';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Bluetooth,
    Check,
    ChevronDown,
    Headphones,
    Mic,
    MicOff,
    PhoneOff,
    Smartphone,
    Video,
    VideoOff,
    Volume2,
    WifiOff,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';
import { CallAvatar } from './CallAvatar';
import { CallButton } from './CallButton';

const ROUTE_META: Record<string, { label: string; Icon: any }> = {
    EARPIECE: { label: 'Phone', Icon: Smartphone },
    SPEAKER_PHONE: { label: 'Speaker', Icon: Volume2 },
    WIRED_HEADSET: { label: 'Headphones', Icon: Headphones },
    BLUETOOTH: { label: 'Bluetooth', Icon: Bluetooth },
};

/** m:ss since the call connected, ticking every second. */
function useElapsed(connectedAt: number | null) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!connectedAt) return;
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [connectedAt]);

    if (!connectedAt) return '0:00';
    const s = Math.max(0, Math.floor((now - connectedAt) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Everything that is not "someone is calling me":
 *   outgoing / connecting / active (timer + controls + video) / ended (short summary)
 */
export function ActiveCallScreen() {
    const { state, endCall, toggleMute, toggleSpeaker, toggleCamera, audioDevices, audioRoute, setAudioRoute } =
        useCall();
    const insets = useSafeAreaInsets();
    const elapsed = useElapsed(state.phase === 'active' ? state.connectedAt : null);
    const [routeOpen, setRouteOpen] = useState(false);

    const { phase } = state;
    const isEnded = phase === 'ended';
    const isActive = phase === 'active';
    const showRemoteVideo = isActive && state.peerVideoOn && !!state.remoteVideoURL;
    const showLocalPreview = isActive && state.isCameraOn && !!state.localVideoURL;

    const hasExternal = audioDevices.includes('BLUETOOTH') || audioDevices.includes('WIRED_HEADSET');
    const routeMeta = ROUTE_META[audioRoute] ?? ROUTE_META.EARPIECE;

    const status = isEnded
        ? state.endLabel ?? 'Call ended'
        : phase === 'outgoing'
          ? 'Calling…'
          : phase === 'connecting'
            ? 'Connecting…'
            : elapsed;

    const statusColor = isEnded && state.endTone === 'bad' ? 'text-red-400' : 'text-white/70';

    return (
        <View className="flex-1 bg-black">
            {showRemoteVideo ? (
                <>
                    {/* key bumps when the remote video track changes so the native view re-mounts cleanly */}
                    <RTCView
                        key={`remote-${state.remoteVersion}`}
                        streamURL={state.remoteVideoURL as string}
                        objectFit="cover"
                        style={StyleSheet.absoluteFill}
                    />
                    {/* keeps the name and controls readable on bright video */}
                    <LinearGradient
                        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.65)']}
                        locations={[0, 0.25, 0.7, 1]}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
                </>
            ) : (
                <LinearGradient
                    colors={['#010206', '#060f2e', '#010206']}
                    locations={[0, 0.5, 1]}
                    style={StyleSheet.absoluteFill}
                />
            )}

            <View
                className="flex-1 items-center justify-between"
                style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 36 }}
            >
                {/* Who + status */}
                <Animated.View entering={FadeInDown.duration(350)} className="items-center px-6">
                    <Text numberOfLines={1} className="max-w-[90%] text-[28px] font-extrabold text-white">
                        {state.peer?.username}
                    </Text>
                    <Text className={`mt-1.5 text-[15px] font-medium ${statusColor}`}>{status}</Text>

                    {isActive && state.networkWeak ? (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            className="mt-3 flex-row items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1.5"
                        >
                            <WifiOff size={13} color="#fbbf24" strokeWidth={2.4} />
                            <Text className="text-[12px] font-semibold text-amber-300">Poor connection</Text>
                        </Animated.View>
                    ) : null}

                    {isActive && state.peerMuted ? (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            className="mt-2 flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"
                        >
                            <MicOff size={13} color="#ffffff" strokeWidth={2.4} />
                            <Text className="text-[12px] font-semibold text-white/80">{state.peer?.username} is muted</Text>
                        </Animated.View>
                    ) : null}
                </Animated.View>

                {/* Avatar (hidden while their video fills the screen) */}
                {showRemoteVideo ? (
                    <View />
                ) : (
                    <Animated.View entering={FadeIn.duration(400)}>
                        <CallAvatar
                            uri={state.peer?.profilePic}
                            name={state.peer?.username}
                            pulsing={phase === 'outgoing' || phase === 'connecting'}
                        />
                    </Animated.View>
                )}

                {/* Controls */}
                {isEnded ? (
                    <View style={{ height: 96 }} />
                ) : (
                    <Animated.View entering={FadeInUp.duration(350)} className="w-full flex-row items-center justify-around px-6">
                        <CallButton
                            Icon={state.isMuted ? MicOff : Mic}
                            label={state.isMuted ? 'Unmute' : 'Mute'}
                            tone={state.isMuted ? 'active' : 'glass'}
                            onPress={toggleMute}
                        />
                        <CallButton
                            Icon={hasExternal ? routeMeta.Icon : Volume2}
                            label={hasExternal ? routeMeta.label : 'Speaker'}
                            tone={
                                hasExternal
                                    ? audioRoute === 'EARPIECE'
                                        ? 'glass'
                                        : 'active'
                                    : state.isSpeaker
                                      ? 'active'
                                      : 'glass'
                            }
                            onPress={hasExternal ? () => setRouteOpen(true) : toggleSpeaker}
                        />
                        <CallButton
                            Icon={state.isCameraOn ? VideoOff : Video}
                            label={state.isCameraOn ? 'Camera off' : 'Camera'}
                            tone={state.isCameraOn ? 'active' : 'glass'}
                            disabled={!isActive}
                            onPress={() => {
                                void toggleCamera();
                            }}
                        />
                        <CallButton
                            Icon={PhoneOff}
                            label="End"
                            tone="danger"
                            onPress={() => {
                                void endCall();
                            }}
                        />
                    </Animated.View>
                )}
            </View>

            {/* Minimize -> call continues in the glass pill while you use the app */}
            {!isEnded ? (
                <Pressable
                    onPress={() => setMinimized(true)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Minimize call"
                    className="absolute h-10 w-10 items-center justify-center rounded-full bg-white/10"
                    style={{ left: 16, top: insets.top + 12 }}
                >
                    <ChevronDown size={22} color="#fff" strokeWidth={2.4} />
                </Pressable>
            ) : null}

            {/* Audio output picker (shown when bluetooth / wired is available) */}
            {routeOpen && !isEnded ? (
                <>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setRouteOpen(false)} />
                    <Animated.View
                        entering={FadeInDown.duration(200)}
                        exiting={FadeOut.duration(150)}
                        className="absolute left-5 right-5 rounded-3xl border border-white/15 bg-black/85 p-2"
                        style={{ bottom: insets.bottom + 150 }}
                    >
                        {audioDevices.map((d) => {
                            const m = ROUTE_META[d];
                            if (!m) return null;
                            return (
                                <Pressable
                                    key={d}
                                    onPress={() => {
                                        void setAudioRoute(d);
                                        setRouteOpen(false);
                                    }}
                                    className="flex-row items-center rounded-2xl px-4 py-3.5 active:bg-white/10"
                                >
                                    <m.Icon size={20} color="#fff" strokeWidth={2.2} />
                                    <Text className="ml-3 flex-1 text-[15px] font-semibold text-white">{m.label}</Text>
                                    {d === audioRoute ? <Check size={18} color="#38bdf8" strokeWidth={2.6} /> : null}
                                </Pressable>
                            );
                        })}
                    </Animated.View>
                </>
            ) : null}

            {/* My own camera, picture-in-picture */}
            {showLocalPreview ? (
                <Animated.View
                    entering={FadeIn.duration(250)}
                    className="absolute overflow-hidden rounded-2xl border border-white/20 bg-neutral-900"
                    style={{ right: 16, top: insets.top + 12, width: 104, height: 148 }}
                >
                    <RTCView
                        streamURL={state.localVideoURL as string}
                        objectFit="cover"
                        mirror
                        zOrder={1}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            ) : null}
        </View>
    );
}