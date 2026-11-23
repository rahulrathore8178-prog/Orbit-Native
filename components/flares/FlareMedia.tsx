import { ACTIONS_ROW_HEIGHT, FILL_TOLERANCE, TOP_UI_HEIGHT } from '@/constants/flares/contants';
import { useFlareLayout } from '@/hooks/flares/useFlaresLayout';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, View } from 'react-native';
import { Easing, SharedValue, withTiming } from 'react-native-reanimated';
import type { FlareMediaInfo } from './flaresUtils';

const safe = (fn: () => void) => {
    try {
        fn();
    } catch {
        /* player already released */
    }
};

/** What the gesture layer can do to the player. */
export type FlarePlayerApi = {
    seekBy: (delta: number) => void;
    seekTo: (t: number) => void;
    setRate: (r: number) => void;
    getTime: () => number;
    getDuration: () => number;
};

type VideoProps = {
    uri: string;
    fit: 'cover' | 'contain';
    w: number;
    h: number;
    active: boolean;
    playing: boolean;
    muted: boolean;
    onRatio: (r: number) => void;
    controlRef?: React.MutableRefObject<FlarePlayerApi | null>;
    progress?: SharedValue<number>;
    duration?: SharedValue<number>;
    scrubbing?: SharedValue<number>;
};

function FlareVideo({ uri, fit, w, h, active, playing, muted, onRatio, controlRef, progress, duration, scrubbing }: VideoProps) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
    });
    const fade = useRef(new Animated.Value(0)).current;
    const shown = useRef(false);

    const reveal = useCallback(() => {
        if (shown.current) return;
        shown.current = true;
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }, [fade]);

    useEffect(() => {
        const t = setTimeout(reveal, 1500); // safety net if the first-frame event never fires
        return () => clearTimeout(t);
    }, [reveal]);

    useEffect(() => { safe(() => { player.muted = muted; }); }, [muted, player]);
    useEffect(() => { safe(() => (playing ? player.play() : player.pause())); }, [playing, player]);

    // controller for seek / speed (pitch is always preserved, so audio quality is untouched)
    useEffect(() => {
        if (!controlRef) return;
        const seekTo = (t: number) =>
            safe(() => {
                const d = player.duration;
                const max = d > 0 ? d - 0.05 : Math.max(0, t);
                const next = Math.max(0, Math.min(t, max));
                player.currentTime = next;
                if (progress && d > 0) progress.value = next / d;
            });
        const api: FlarePlayerApi = {
            seekTo,
            seekBy: (delta) => {
                let now = 0;
                safe(() => { now = player.currentTime; });
                seekTo(now + delta);
            },
            setRate: (r) => safe(() => {
                player.preservesPitch = true;
                player.playbackRate = r;
            }),
            getTime: () => { let t = 0; safe(() => { t = player.currentTime; }); return t; },
            getDuration: () => { let d = 0; safe(() => { d = player.duration; }); return d; },
        };
        controlRef.current = api;
        return () => { if (controlRef.current === api) controlRef.current = null; };
    }, [player, controlRef, progress]);

    // progress feed for the seek bar (10 updates/s, glided to look continuous)
    useEffect(() => {
        if (!progress || !duration) return;
        safe(() => { player.timeUpdateEventInterval = 0.1; });
        const sub = player.addListener('timeUpdate', ({ currentTime }) => {
            let d = 0;
            safe(() => { d = player.duration; });
            if (d > 0) duration.value = d;
            if (d <= 0 || (scrubbing && scrubbing.value > 0.5)) return;
            const p = Math.min(1, Math.max(0, currentTime / d));
            if (p < progress.value - 0.3) progress.value = p; // loop wrap: jump, don't sweep back
            else progress.value = withTiming(p, { duration: 120, easing: Easing.linear });
        });
        return () => safe(() => sub.remove());
    }, [player, progress, duration, scrubbing]);

    // restart from the top once it has fully left the screen
    useEffect(() => {
        if (active) return;
        const t = setTimeout(() => {
            safe(() => {
                player.currentTime = 0;
                player.playbackRate = 1;
            });
            if (progress) progress.value = 0;
        }, 350);
        return () => clearTimeout(t);
    }, [active, player, progress]);

    // learn the real video ratio so wide clips get the blurred-backdrop treatment
    useEffect(() => {
        const read = (t: any) => {
            const s = t?.size;
            if (s?.width && s?.height) onRatio(s.width / s.height);
        };
        safe(() => read((player as any).videoTrack));
        const sub = player.addListener('videoTrackChange' as any, ({ videoTrack }: any) => read(videoTrack));
        return () => safe(() => sub.remove());
    }, [player, onRatio]);

    return (
        <Animated.View style={{ width: w, height: h, opacity: fade }}>
            <VideoView
                player={player}
                style={{ width: '100%', height: '100%' }}
                contentFit={fit}
                nativeControls={false}
                surfaceType="textureView"
                onFirstFrameRender={reveal}
            />
        </Animated.View>
    );
}

type Props = {
    media: FlareMediaInfo;
    pageH: number;
    active: boolean;
    near: boolean;
    playing: boolean;
    muted: boolean;
    controlRef?: React.MutableRefObject<FlarePlayerApi | null>;
    progress?: SharedValue<number>;
    duration?: SharedValue<number>;
    scrubbing?: SharedValue<number>;
};

export function FlareMedia({ media, pageH, active, near, playing, muted, controlRef, progress, duration, scrubbing }: Props) {
    const { width, topChrome, actionsBottom } = useFlareLayout();
    const [measured, setMeasured] = useState<number | null>(null);
    const onRatio = useCallback((r: number) => setMeasured((p) => (p === r ? p : r)), []);

    const ratio = media.ratio ?? measured ?? (media.type === 'video' ? 9 / 16 : 4 / 5);
    const screenRatio = width / pageH;
    // tall / reel-shaped media bleeds edge to edge, under the floating tab bar
    const fills = ratio <= screenRatio * (1 + FILL_TOLERANCE);

    let x = 0, y = 0, w = width, h = pageH;
    if (!fills) {
        const top = topChrome + (media.type === 'video' ? TOP_UI_HEIGHT : TOP_UI_HEIGHT - 40);
        const bottom = actionsBottom + ACTIONS_ROW_HEIGHT;
        const region = pageH - top - bottom;
        w = width;
        h = w / ratio;
        if (h > region) {
            h = region;
            w = h * ratio;
        }
        x = (width - w) / 2;
        y = top + (region - h) / 2;
    }
    const fit = fills ? 'cover' : 'contain';

    const content =
        media.type === 'video' ? (
            near ? (
                <FlareVideo
                    uri={media.uri}
                    fit={fit}
                    w={w}
                    h={h}
                    active={active}
                    playing={playing}
                    muted={muted}
                    onRatio={onRatio}
                    controlRef={controlRef}
                    progress={progress}
                    duration={duration}
                    scrubbing={scrubbing}
                />
            ) : null
        ) : (
            <Image
                source={{ uri: media.uri }}
                style={{ width: w, height: h }}
                resizeMode={fit}
                fadeDuration={200}
                onLoad={(e: any) => {
                    const s = e.nativeEvent?.source;
                    if (s?.width && s?.height && !media.ratio) onRatio(s.width / s.height);
                }}
            />
        );

    return (
        <View className="absolute inset-0 bg-black">
            {!fills && media.type === 'image' && (
                <>
                    <Image
                        source={{ uri: media.uri }}
                        blurRadius={Platform.OS === 'ios' ? 50 : 22}
                        resizeMode="cover"
                        className="absolute inset-0 opacity-70"
                        style={{ transform: [{ scale: 1.15 }] }}
                    />
                    <View className="absolute inset-0 bg-black/40" />
                </>
            )}
            <View className="absolute overflow-hidden" style={{ left: x, top: y, width: w, height: h }}>
                {content}
            </View>
        </View>
    );
}