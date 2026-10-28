import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pause, Play } from 'lucide-react-native';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../ui/neo';
import type { CommentMedia } from '../services/comments/commentsApi';

/** Keeps images "small and expressive": bounded box, aspect ratio preserved, never full panel width. */
function boxSize(w?: number, h?: number, maxW = 216, maxH = 270) {
    const ratio = w && h ? Math.min(Math.max(w / h, 0.62), 1.6) : 1;
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
        height = maxH;
        width = height * ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
}

function UploadOverlay({ progress = 0 }: { progress?: number }) {
    return (
        <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none">
            <ActivityIndicator color="#fff" />
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(6, Math.round(progress * 100))}%` }]} />
            </View>
        </View>
    );
}

function Picture({ media, uploading, progress, onPress }: {
    media: Extract<CommentMedia, { type: 'image' | 'gif' }>;
    uploading?: boolean;
    progress?: number;
    onPress?: () => void;
}) {
    const isGif = media.type === 'gif';
    const size = isGif ? boxSize(media.width, media.height, 196, 230) : boxSize(media.width, media.height);
    return (
        <Pressable onPress={onPress} disabled={!onPress} style={[styles.pic, size]} accessibilityLabel={isGif ? 'GIF' : 'Photo'}>
            <Image
                source={{ uri: media.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                recyclingKey={media.url}
            />
            {isGif ? (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>GIF</Text>
                </View>
            ) : null}
            {uploading ? <UploadOverlay progress={progress} /> : null}
        </Pressable>
    );
}

function Sticker({ media }: { media: Extract<CommentMedia, { type: 'sticker' }> }) {
    return (
        <Image
            source={{ uri: media.url }}
            style={{ width: 128, height: 128 }}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={media.url}
        />
    );
}

/* ---------- voice note ---------- */
const BARS = 28;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function barHeights(seed: string) {
    let h = 2166136261;
    return Array.from({ length: BARS }, (_, i) => {
        h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619);
        return 0.3 + (((h >>> 0) % 1000) / 1000) * 0.7;
    });
}

// one voice note at a time; stores a pause callback + owner id, never the raw player
let currentlyPlaying: { id: symbol; pause: () => void } | null = null;

const VoiceBubble = memo(function VoiceBubble({ uri, duration, seed }: { uri: string; duration: number; seed: string }) {
    const [src, setSrc] = useState<string | null>(null); // loaded on first tap
    const player = useAudioPlayer(src);
    const status = useAudioPlayerStatus(player);
    const wantPlay = useRef(false);
    const playingRef = useRef(false);
    const idRef = useRef(Symbol('voice'));
    const bars = useMemo(() => barHeights(seed), [seed]);

    playingRef.current = status.playing;
    const total = status.duration > 0 ? status.duration : duration || 1;
    const progress = Math.min(1, status.currentTime / total);

    // when this bubble unmounts its native player is released: drop any reference to it
    useEffect(() => {
        const id = idRef.current;
        return () => {
            if (currentlyPlaying?.id === id) currentlyPlaying = null;
        };
    }, []);

    useEffect(() => {
        try { player.loop = false; } catch { /* released */ }
    }, [player]);

    const startPlayback = () => {
        try {
            if (currentlyPlaying && currentlyPlaying.id !== idRef.current) currentlyPlaying.pause();
        } catch { /* that player was already released */ }
        currentlyPlaying = {
            id: idRef.current,
            pause: () => { try { player.pause(); } catch { /* released */ } },
        };
        try {
            player.play();
        } catch (e) {
            console.warn('[voice note] play failed', e);
        }
    };

    // first tap: the player is recreated for the new source, so keep nudging play()
    // until it actually starts (gives up after ~5 seconds)
    useEffect(() => {
        if (!src || !wantPlay.current) return;
        let tries = 0;
        const t = setInterval(() => {
            if (playingRef.current || tries++ > 20) {
                wantPlay.current = false;
                clearInterval(t);
                return;
            }
            startPlayback();
        }, 250);
        return () => clearInterval(t);
    }, [src, player]);

    useEffect(() => {
        if (status.didJustFinish) {
            try {
                player.pause();
                player.seekTo(0);
            } catch { /* released */ }
        }
    }, [status.didJustFinish, player]);

    const toggle = async () => {
        try {
            if (status.playing) {
                wantPlay.current = false;
                player.pause();
                return;
            }
            await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
            if (!src) {
                wantPlay.current = true;
                setSrc(uri);
            } else {
                startPlayback();
            }
        } catch (e) {
            console.warn('[voice note] playback failed', uri, e);
        }
    };

    return (
        <View style={styles.voice}>
            <Pressable onPress={toggle} style={styles.playBtn} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}>
                {status.playing ? <Pause size={16} color="#fff" fill="#fff" /> : <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />}
            </Pressable>
            <View style={styles.wave}>
                {bars.map((v, i) => (
                    <View
                        key={i}
                        style={{
                            width: 3,
                            height: 5 + v * 20,
                            borderRadius: 2,
                            backgroundColor: i / BARS < progress ? COLORS.accent : 'rgba(255,255,255,0.3)',
                        }}
                    />
                ))}
            </View>
            <Text style={styles.time}>{fmt(status.playing || progress > 0 ? status.currentTime : duration)}</Text>
        </View>
    );
});

/* ---------- entry ---------- */
export const CommentMediaView = memo(function CommentMediaView({
    media, seed, uploading, progress, onOpenImage,
}: {
    media: CommentMedia;
    seed: string;
    uploading?: boolean;
    progress?: number;
    onOpenImage?: (url: string) => void;
}) {
    if (media.type === 'audio') return <VoiceBubble uri={media.url} duration={media.duration} seed={seed} />;
    if (media.type === 'sticker') return <Sticker media={media} />;
    return (
        <Picture
            media={media}
            uploading={uploading}
            progress={progress}
            onPress={media.type === 'image' ? () => onOpenImage?.(media.url) : undefined}
        />
    );
});

const styles = StyleSheet.create({
    pic: { borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
    scrim: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 10 },
    track: { width: '60%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    fill: { height: 3, backgroundColor: '#fff' },
    badge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    voice: {
        flexDirection: 'row', alignItems: 'center', gap: 10, width: 232,
        paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
    },
    playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
    wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 28 },
    time: { color: COLORS.muted, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'right' },
});