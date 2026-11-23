import { LIKE_COLOR } from '@/constants/flares/contants';
import type { FlareHandlers, FlarePost } from '@/constants/flares/types';
import { usePostActions } from '@/hooks/feed/usePostActions';
import { useFlareLayout } from '@/hooks/flares/useFlaresLayout';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { FlareActions } from './FlareActions';
import { FlareAuthorRow } from './FlareAuthorRow';
import { animateCaption, FlareCaption } from './FlareCaption';
import { FlareControls } from './FlareControls';
import { FlareGestures, type Zone } from './FlareGestures';
import { FlareMedia, type FlarePlayerApi } from './FlareMedia';
import { FlareSeekBar } from './FlareSeekBar';
import { FlareSeekFx, type SeekFxHandle } from './FlareSeekFx';
import { resolveMedia } from './flaresUtils';

const SEEK_SECONDS = 5;
const SEEK_CHAIN_MS = 650; // taps within this window keep seeking after a double tap
const SPEED = 2;

const fmt = (s: number) => {
    const t = Math.max(0, Math.floor(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const buzz = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => { });
};

type Props = {
    post: FlarePost;
    active: boolean;
    near: boolean;
    pageH: number;
    muted: boolean;
    isFollowing: boolean;
    handlers: FlareHandlers;
};

function FlareItemBase({ post, active, near, pageH, muted, isFollowing, handlers }: Props) {
    const { width, topChrome, actionsBottom } = useFlareLayout();
    const media = useMemo(() => resolveMedia(post), [post.video, post.image, post.voiceNote, post.mediaWidth, post.mediaHeight]);
    const isVideo = media?.type === 'video';
    const actions = usePostActions(post);

    const [paused, setPaused] = useState(false);
    const [captionOpen, setCaptionOpen] = useState(false);
    const playing = active && !paused;

    /* ---- player + shared UI state ---- */
    const player = useRef<FlarePlayerApi | null>(null);
    const progress = useSharedValue(0);
    const duration = useSharedValue(0);
    const scrubbing = useSharedValue(0); // 0..1, drives the expanded bar
    const hold = useSharedValue(0); // 0..1, fades the UI while holding
    const speedSV = useSharedValue(0);
    const pauseSV = useSharedValue(0);
    const scrimSV = useSharedValue(0);
    const bScale = useSharedValue(0);
    const bOp = useSharedValue(0);

    const [burst, setBurst] = useState({ x: 0, y: 0, rot: 0 });
    const [scrubT, setScrubT] = useState(0);
    const [scrubDur, setScrubDur] = useState(0);

    const fx = useRef<SeekFxHandle>(null);
    const chain = useRef({ at: 0, side: 'right' as 'left' | 'right', total: 0 });

    useEffect(() => { if (!active) { setPaused(false); setCaptionOpen(false); } }, [active]);

    useEffect(() => {
        pauseSV.value = withSpring(paused && isVideo ? 1 : 0, { damping: 14, stiffness: 220, mass: 0.7 });
    }, [paused, isVideo, pauseSV]);

    useEffect(() => {
        scrimSV.value = withTiming(captionOpen ? 1 : 0, { duration: 220 });
    }, [captionOpen, scrimSV]);

    // never leave a flare running at 2x
    useEffect(() => {
        if (active) return;
        speedSV.value = 0;
        player.current?.setRate(1);
    }, [active, speedSV]);

    /* ---- caption ---- */
    const toggleCaption = useCallback(() => {
        animateCaption();
        setCaptionOpen((v) => !v);
    }, []);

    /* ---- gesture handlers ---- */
    const playBurst = useCallback((x: number, y: number) => {
        setBurst({ x, y, rot: Math.random() * 30 - 15 });
        bScale.value = 0.4;
        bOp.value = 1;
        bScale.value = withSpring(1, { damping: 9, stiffness: 200, mass: 0.6 });
        bOp.value = withDelay(420, withTiming(0, { duration: 240 }));
    }, [bScale, bOp]);

    const doSeek = useCallback((dir: -1 | 1) => {
        const side = dir < 0 ? 'left' : 'right';
        const now = Date.now();
        const c = chain.current;
        c.total = now - c.at < SEEK_CHAIN_MS && c.side === side ? c.total + SEEK_SECONDS : SEEK_SECONDS;
        c.at = now;
        c.side = side;
        player.current?.seekBy(dir * SEEK_SECONDS);
        fx.current?.show(side, c.total);
        buzz();
    }, []);

    const onTap = useCallback((zone: Zone) => {
        if (captionOpen) {
            animateCaption();
            setCaptionOpen(false);
            return;
        }
        if (!isVideo) return;
        // right after a double-tap seek, single taps on that side keep seeking
        const c = chain.current;
        if (zone !== 1 && Date.now() - c.at < SEEK_CHAIN_MS && c.side === (zone === 0 ? 'left' : 'right')) {
            doSeek(zone === 0 ? -1 : 1);
            return;
        }
        setPaused((p) => !p);
    }, [captionOpen, isVideo, doSeek]);

    const onDoubleTap = useCallback((zone: Zone, x: number, y: number) => {
        if (isVideo && zone !== 1) {
            doSeek(zone === 0 ? -1 : 1);
            return;
        }
        playBurst(x, y);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        actions.like(true);
    }, [isVideo, doSeek, playBurst, actions]);

    const onSpeed = useCallback((on: boolean) => {
        if (!isVideo) return;
        player.current?.setRate(on ? SPEED : 1);
        speedSV.value = withSpring(on ? 1 : 0, { damping: 16, stiffness: 240, mass: 0.7 });
        if (on) buzz(Haptics.ImpactFeedbackStyle.Medium);
    }, [isVideo, speedSV]);

    const onScrubStart = useCallback(() => {
        if (!isVideo) return;
        setScrubDur(duration.value);
        setScrubT(progress.value * duration.value);
        buzz(Haptics.ImpactFeedbackStyle.Medium);
    }, [isVideo, duration, progress]);

    const onScrubMove = useCallback((t: number) => {
        player.current?.seekTo(t);
        setScrubT(t);
    }, []);

    const onScrubEnd = useCallback((t: number) => {
        player.current?.seekTo(t);
        buzz();
    }, []);

    /* ---- animated styles ---- */
    const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - hold.value }));
    const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimSV.value }));
    const pauseStyle = useAnimatedStyle(() => ({
        opacity: pauseSV.value,
        transform: [{ scale: 0.7 + pauseSV.value * 0.3 }],
    }));
    const speedStyle = useAnimatedStyle(() => ({
        opacity: speedSV.value,
        transform: [{ translateY: (1 - speedSV.value) * -10 }, { scale: 0.9 + speedSV.value * 0.1 }],
    }));
    const burstStyle = useAnimatedStyle(() => ({
        opacity: bOp.value,
        transform: [{ scale: bScale.value }, { rotate: `${burst.rot}deg` }],
    }));

    if (!media) return <View className="bg-black" style={{ width, height: pageH }} />;

    return (
        <View className="overflow-hidden bg-black" style={{ width, height: pageH }}>
            <FlareMedia
                media={media}
                pageH={pageH}
                active={active}
                near={near}
                playing={playing}
                muted={muted}
                controlRef={player}
                progress={progress}
                duration={duration}
                scrubbing={scrubbing}
            />

            {/* one gesture layer for the whole screen: zones, double tap, hold, scrub */}
            <FlareGestures
                width={width}
                progress={progress}
                duration={duration}
                scrubbing={scrubbing}
                hold={hold}
                onTap={onTap}
                onDoubleTap={onDoubleTap}
                onSpeed={onSpeed}
                onScrubStart={onScrubStart}
                onScrubMove={onScrubMove}
                onScrubEnd={onScrubEnd}
            />

            {/* scrims fade to transparent, so nothing ever looks cut off at the bottom */}
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topChrome + 150 }}
            />
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: actionsBottom + 230 }}
            />
            {/* dims the video while a long caption is open */}
            <Animated.View pointerEvents="none" className="absolute inset-0 bg-black/45" style={scrimStyle} />

            <Animated.View pointerEvents="box-none" className="absolute inset-x-0 top-0" style={[{ paddingTop: topChrome }, chromeStyle]}>
                <FlareAuthorRow post={post} isFollowing={isFollowing} handlers={handlers} />
                {isVideo && (
                    <FlareControls
                        paused={paused}
                        muted={muted}
                        onTogglePause={() => setPaused((p) => !p)}
                        onToggleMute={handlers.onToggleMute}
                    />
                )}
            </Animated.View>

            <Animated.View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 px-4" style={[{ paddingBottom: actionsBottom }, chromeStyle]}>
                <FlareCaption post={post} onHashtag={handlers.onHashtag} expanded={captionOpen} onToggle={toggleCaption} />
                <FlareActions postId={post.id} actions={actions} onComment={handlers.onOpenComments} onShare={handlers.onShare} />
            </Animated.View>

            {isVideo && (
                <>
                    <FlareSeekFx ref={fx} />
                    <FlareSeekBar
                        progress={progress}
                        scrubbing={scrubbing}
                        bottom={Math.max(actionsBottom - 17, 4)}
                        label={fmt(scrubT)}
                        total={fmt(scrubDur)}
                    />
                    <View pointerEvents="none" className="absolute inset-x-0 items-center" style={{ top: topChrome + 64 }}>
                        <Animated.View className="flex-row items-center rounded-full bg-black/55 px-3.5 py-2" style={speedStyle}>
                            <Ionicons name="play-forward" size={15} color="#fff" />
                            <Text className="ml-1.5 text-[14px] font-bold text-white">{SPEED}x</Text>
                        </Animated.View>
                    </View>
                </>
            )}

            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                <Animated.View style={pauseStyle}>
                    <View className="h-20 w-20 items-center justify-center rounded-full bg-black/45">
                        <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
                    </View>
                </Animated.View>
            </View>

            <View pointerEvents="none" className="absolute inset-0">
                <Animated.View className="absolute" style={[{ left: burst.x - 52, top: burst.y - 52 }, burstStyle]}>
                    <Ionicons name="heart" size={104} color={LIKE_COLOR} />
                </Animated.View>
            </View>
        </View>
    );
}

export const FlareItem = memo(FlareItemBase);