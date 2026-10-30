import { setMinimized } from '@/lib/calls/callUI';
import { useCall } from '@/lib/calls/callProvider';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Phone, PhoneOff } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const ROUND = { alignItems: 'center', justifyContent: 'center' } as const;

export function CallPill() {
    const { state, endCall, acceptCall, rejectCall } = useCall();
    const insets = useSafeAreaInsets();
    const elapsed = useElapsed(state.phase === 'active' ? state.connectedAt : null);
    const { phase, peer } = state;

    const status =
        phase === 'incoming' ? 'Incoming call'
            : phase === 'outgoing' ? 'Calling…'
                : phase === 'connecting' ? 'Connecting…'
                    : phase === 'ended' ? state.endLabel ?? 'Call ended'
                        : elapsed;

    const initial = (peer?.username?.trim()?.[0] ?? '?').toUpperCase();

    return (
        // full-width layer only centers the pill; touches pass through everywhere else
        <Animated.View
            pointerEvents="box-none"
            // short, well-damped drop: a small settle instead of a bounce
            entering={FadeInUp.springify().damping(24).stiffness(260).mass(0.7)}
            exiting={FadeOutUp.duration(160)}
            style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 6, alignItems: 'center', zIndex: 998, elevation: 998 }}
        >
            <Pressable
                onPress={() => {
                    Haptics.selectionAsync();
                    setMinimized(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Return to call"
                style={{
                    minWidth: 176,
                    maxWidth: 252,
                    borderRadius: 999,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.16)',
                }}
            >
                <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,10,24,0.74)' }]} />

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 5, paddingRight: 6 }}>
                    <View
                        style={[ROUND, { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' }]}
                    >
                        {peer?.profilePic ? (
                            <Image source={{ uri: peer.profilePic }} style={{ width: 32, height: 32 }} contentFit="cover" />
                        ) : (
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{initial}</Text>
                        )}
                    </View>

                    <View style={{ flexGrow: 1, flexShrink: 1, marginHorizontal: 9 }}>
                        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
                            {peer?.username}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {phase === 'active' ? (
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399', marginRight: 5 }} />
                            ) : null}
                            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontVariant: ['tabular-nums'] }}>
                                {status}
                            </Text>
                        </View>
                    </View>

                    {phase === 'incoming' ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable
                                onPress={() => void rejectCall()}
                                hitSlop={6}
                                style={[ROUND, { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444' }]}
                            >
                                <PhoneOff size={14} color="#fff" strokeWidth={2.4} />
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    setMinimized(false);
                                    void acceptCall();
                                }}
                                hitSlop={6}
                                style={[ROUND, { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981' }]}
                            >
                                <Phone size={14} color="#fff" strokeWidth={2.4} />
                            </Pressable>
                        </View>
                    ) : phase !== 'ended' ? (
                        <Pressable
                            onPress={() => void endCall()}
                            hitSlop={6}
                            style={[ROUND, { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444' }]}
                        >
                            <PhoneOff size={14} color="#fff" strokeWidth={2.4} />
                        </Pressable>
                    ) : null}
                </View>
            </Pressable>
        </Animated.View>
    );
}