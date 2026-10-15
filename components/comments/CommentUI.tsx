import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pause, Play, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { resolveUrl } from '../orbital/orbitalData';
import { formatDuration, IconButton } from '../posts/PostMedia';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';

/** Fade + slide-up on mount. */
export function FadeIn({
    children,
    delay = 0,
    y = 10,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    y?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const v = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(v, {
            toValue: 1,
            duration: 280,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [v, delay]);

    return (
        <Animated.View
            style={[
                style,
                { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] },
            ]}
        >
            {children}
        </Animated.View>
    );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string; name?: string; size?: number }) {
    const [failed, setFailed] = useState(false);
    const src = resolveUrl(uri);
    const inner = size - 8;

    return (
        <NeoView radius={size / 2} style={{ width: size, height: size }}>
            {src && !failed ? (
                <Image
                    source={{ uri: src }}
                    onError={() => setFailed(true)}
                    style={{ width: inner, height: inner, borderRadius: inner / 2 }}
                />
            ) : (
                <Text style={{ color: COLORS.text, fontSize: size * 0.4, fontWeight: '800' }}>
                    {(name?.trim()?.[0] ?? '?').toUpperCase()}
                </Text>
            )}
        </NeoView>
    );
}

export function CommentSkeleton() {
    const v = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(v, { toValue: 0.85, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(v, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [v]);

    return (
        <Animated.View style={{ opacity: v, flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <GlassPanel radius={18} style={{ flex: 1, height: 68 }} />
        </Animated.View>
    );
}

/** Compact voice-note player for comments. */
export function VoicePlayer({ uri, duration }: { uri: string; duration: number }) {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
        if (status.didJustFinish) player.seekTo(0);
    }, [status.didJustFinish, player]);

    const total = status.duration || duration;
    const pct = total > 0 ? Math.min(1, status.currentTime / total) : 0;
    const shown = status.playing || status.currentTime > 0 ? status.currentTime : total;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <IconButton
                Icon={status.playing ? Pause : Play}
                label={status.playing ? 'Pause voice note' : 'Play voice note'}
                size={36}
                onPress={() => (status.playing ? player.pause() : player.play())}
            />
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: COLORS.text, borderRadius: 3 }} />
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 12, minWidth: 34, textAlign: 'right' }}>
                {formatDuration(shown)}
            </Text>
        </View>
    );
}

function ActiveVideo({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
        p.play();
    });
    return (
        <View style={{ height: 220, borderRadius: 16, overflow: 'hidden', marginTop: 8, backgroundColor: '#000' }}>
            <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: '100%' }} />
        </View>
    );
}

/** Players are only created after a tap, so a long list never spins up dozens of them. */
export function VideoTap({ uri }: { uri: string }) {
    const [active, setActive] = useState(false);
    if (active) return <ActiveVideo uri={uri} />;

    return (
        <Pressable onPress={() => setActive(true)} accessibilityRole="button" accessibilityLabel="Play video">
            <GlassPanel radius={16} style={{ height: 160, marginTop: 8, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <NeoView radius={28} style={{ width: 56, height: 56 }}>
                    <Play size={22} color={COLORS.text} />
                </NeoView>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>Tap to play</Text>
            </GlassPanel>
        </Pressable>
    );
}

export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
    return (
        <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' }}
                onPress={onClose}
            >
                {uri ? <Image source={{ uri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
            </Pressable>
            <View style={{ position: 'absolute', top: 54, right: 16 }}>
                <IconButton Icon={X} label="Close image" onPress={onClose} size={42} />
            </View>
        </Modal>
    );
}