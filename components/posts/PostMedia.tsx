import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LucideIcon, Pause, Play, Square, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';

export const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Round-cornered neo icon button that "presses in" while held. */
export function IconButton({
    Icon,
    onPress,
    label,
    size = 44,
    color = COLORS.text,
    active = false,
    disabled = false,
}: {
    Icon: LucideIcon;
    onPress?: () => void;
    label: string;
    size?: number;
    color?: string;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{ opacity: disabled ? 0.45 : 1 }}
        >
            {({ pressed }) => (
                <NeoView radius={size * 0.36} pressed={pressed || active} style={{ width: size, height: size }}>
                    <Icon size={size * 0.44} color={color} strokeWidth={2.1} />
                </NeoView>
            )}
        </Pressable>
    );
}

export function VideoPreview({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });
    return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: '100%' }} />;
}

export function RecordingBar({
    seconds,
    max,
    onStop,
}: {
    seconds: number;
    max: number;
    onStop: () => void;
}) {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <GlassPanel radius={20} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Animated.View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f87171', opacity: pulse }}
            />
            <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 15 }}>{formatDuration(seconds)}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12, flex: 1 }}>Recording... max {formatDuration(max)}</Text>
            <IconButton Icon={Square} label="Stop recording" onPress={onStop} size={38} color="#f87171" />
        </GlassPanel>
    );
}

export function VoiceNotePreview({
    uri,
    duration,
    onRemove,
}: {
    uri: string;
    duration: number;
    onRemove: () => void;
}) {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
        if (status.didJustFinish) player.seekTo(0);
    }, [status.didJustFinish, player]);

    const total = status.duration || duration;
    const pct = total > 0 ? Math.min(1, status.currentTime / total) : 0;

    const toggle = () => {
        if (status.playing) player.pause();
        else player.play();
    };

    return (
        <GlassPanel radius={20} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton
                Icon={status.playing ? Pause : Play}
                label={status.playing ? 'Pause preview' : 'Play preview'}
                onPress={toggle}
                size={40}
            />
            <View style={{ flex: 1 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: COLORS.text, borderRadius: 3 }} />
                </View>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    {formatDuration(status.playing || status.currentTime > 0 ? status.currentTime : duration)} /{' '}
                    {formatDuration(total)}
                </Text>
            </View>
            <IconButton Icon={Trash2} label="Remove voice note" onPress={onRemove} size={38} />
        </GlassPanel>
    );
}