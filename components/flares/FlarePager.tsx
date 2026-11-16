import ActionSheet, { SheetAction } from '@/components/ui/ActionSheet';
import type { FlareHandlers, FlarePost } from '@/constants/flares/types';
import { useFlareFollow } from '@/hooks/flares/useFlareFollow';
import { FlareLayoutProvider, useFlareLayout } from '@/hooks/flares/useFlaresLayout';
import { useFlareViews } from '@/hooks/flares/useFlareViews';
import { useGlobalMuted } from '@/hooks/postCard/globalMute';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { router, useIsFocused } from 'expo-router';
import { EyeOff, Flag } from 'lucide-react-native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { FlareHeader } from './FlareHeader';
import { FlareItem } from './FlareItem';
import { FlarePullLoader } from './FlarePullLoader';
import { resolveMedia } from './flaresUtils';

/* ---- page feel: tweak these ---- */
const SPRING = { damping: 28, stiffness: 190, mass: 1, restDisplacementThreshold: 0.5, restSpeedThreshold: 2 };
const SPRING_HOLD = { damping: 22, stiffness: 240, mass: 0.9 }; // pull release / return
const FLICK_V = 650;
const DRAG_FRAC = 0.2;

/* ---- pull to reload ---- */
const PULL_THRESHOLD = 78; // px the page must travel down to arm the reload
const HOLD = 58; // px the page rests at while loading
const MIN_SHOW_MS = 750; // the loader stays at least this long, so quick reloads don't flicker

const rubber = (over: number, h: number) => {
    'worklet';
    return h * 0.18 * (1 - Math.exp(-over / (h * 0.35))); // resistance at the last page
};
// finger travel -> page travel at the top: firm, friendly resistance, capped at 150px
const pullDisp = (over: number) => {
    'worklet';
    return 150 * (1 - Math.exp(-over / 220));
};

export type FlarePagerHandle = {
    /** Scroll to the first flare and reload the feed (tab re-press). */
    refreshFromTop: () => void;
};

type Props = {
    posts: FlarePost[];
    initialIndex?: number;
    enabled?: boolean;
    /** false = opened from Home with the tab bar hidden */
    hasTabBar?: boolean;
    title?: string;
    onBack?: () => void;
    onEndReached?: () => void;
    refreshing?: boolean;
    onRefresh?: () => void | Promise<void>;
    viewsPaused?: boolean;
    onOpenComments: (id: string) => void;
    onShare: (id: string) => void;
};

export const FlarePager = forwardRef<FlarePagerHandle, Props>(function FlarePager(props, ref) {
    return (
        <FlareLayoutProvider hasTabBar={props.hasTabBar ?? true}>
            <PagerInner {...props} pagerRef={ref} />
        </FlareLayoutProvider>
    );
});

function PagerInner({
    posts,
    initialIndex = 0,
    enabled = true,
    title,
    onBack,
    onEndReached,
    refreshing = false,
    onRefresh,
    viewsPaused = false,
    onOpenComments,
    onShare,
    pagerRef,
}: Props & { pagerRef: React.Ref<FlarePagerHandle> }) {
    const { topChrome } = useFlareLayout();
    const focused = useIsFocused();
    const openProfile = useOpenProfile();
    const [muted, setMuted] = useGlobalMuted();
    const { following, toggle } = useFlareFollow();

    const [pageH, setPageH] = useState(0);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const [moreFor, setMoreFor] = useState<FlarePost | null>(null);

    const data = useMemo(() => posts.filter((p) => !hidden.has(p.id)), [posts, hidden]);
    const [activeIndex, setActiveIndex] = useState(Math.min(initialIndex, Math.max(0, data.length - 1)));
    const active = Math.min(activeIndex, Math.max(0, data.length - 1));
    const live = enabled && focused;

    useFlareViews(data[active]?.id, live && !viewsPaused);

    /* ---- shared state for the gesture ---- */
    const offset = useSharedValue(0); // px scrolled; page i sits at i * pageH. Negative = pulled down at the top.
    const startOffset = useSharedValue(0);
    const H = useSharedValue(0);
    const count = useSharedValue(0);
    const busySV = useSharedValue(false);
    const canRefresh = useSharedValue(!!onRefresh);

    useEffect(() => { count.value = data.length; }, [data.length, count]);
    useEffect(() => { canRefresh.value = !!onRefresh; }, [onRefresh, canRefresh]);

    useEffect(() => {
        if (!pageH) return;
        H.value = pageH;
        cancelAnimation(offset);
        offset.value = active * pageH;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageH]);

    // an item got hidden while it was the last one: glide back to the new last page
    useEffect(() => {
        if (activeIndex !== active && pageH) {
            setActiveIndex(active);
            offset.value = withSpring(active * pageH, SPRING);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, activeIndex]);

    /* ---- JS-side refs the worklets call into ---- */
    const activeRef = useRef(active);
    const lenRef = useRef(data.length);
    const endRef = useRef(onEndReached);
    const refreshRef = useRef(onRefresh);
    activeRef.current = active;
    lenRef.current = data.length;
    endRef.current = onEndReached;
    refreshRef.current = onRefresh;

    /* ---- reload state: busy = loader visible + page held down ---- */
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const startedAt = useRef(0);
    const sawProp = useRef(false);
    const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (endTimer.current) clearTimeout(endTimer.current); }, []);

    const finishBusy = useCallback(() => {
        const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - startedAt.current));
        if (endTimer.current) clearTimeout(endTimer.current);
        endTimer.current = setTimeout(() => {
            busyRef.current = false;
            setBusy(false);
        }, wait);
    }, []);

    const begin = useCallback(() => {
        if (busyRef.current) return;
        busyRef.current = true;
        startedAt.current = Date.now();
        sawProp.current = false;
        setBusy(true);
        const request = refreshRef.current?.();
        if (request && typeof (request as Promise<void>).then === 'function') {
            Promise.resolve(request).finally(finishBusy);
        }
    }, [finishBusy]);

    // follow the feed's own `refreshing` flag: an external reload also shows the loader
    useEffect(() => {
        if (refreshing) {
            sawProp.current = true;
            if (!busyRef.current) {
                busyRef.current = true;
                startedAt.current = Date.now();
                setBusy(true);
            }
        } else if (sawProp.current) {
            sawProp.current = false;
            finishBusy();
        }
    }, [refreshing, finishBusy]);

    // safety: if the feed never reported refreshing, don't leave the page held down
    useEffect(() => {
        if (!busy) return;
        const t = setTimeout(() => {
            if (!sawProp.current && busyRef.current) finishBusy();
        }, 1200);
        return () => clearTimeout(t);
    }, [busy, finishBusy]);

    // hold the page down while loading, release it afterwards (only while on the first flare)
    useEffect(() => {
        busySV.value = busy;
        if (!pageH || activeRef.current !== 0) return;
        offset.value = withSpring(busy ? -HOLD : 0, SPRING_HOLD);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy]);

    useImperativeHandle(
        pagerRef,
        () => ({
            refreshFromTop: () => {
                if (!pageH) return;
                if (activeRef.current !== 0) {
                    // only the neighbours are mounted, so jump close (page 1) before gliding to the top
                    activeRef.current = 0;
                    setActiveIndex(0);
                    cancelAnimation(offset);
                    if (offset.value > pageH) offset.value = pageH;
                }
                if (!refreshRef.current) {
                    offset.value = withSpring(0, SPRING);
                    return;
                }
                begin();
                offset.value = withSpring(-HOLD, SPRING_HOLD);
            },
        }),
        [pageH, begin, offset],
    );

    const settle = useCallback((i: number) => {
        if (activeRef.current !== i) {
            activeRef.current = i;
            setActiveIndex(i);
        }
        if (i >= lenRef.current - 3) endRef.current?.();
    }, []);

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetY([-10, 10])
                .failOffsetX([-40, 40])
                .onStart(() => {
                    'worklet';
                    cancelAnimation(offset);
                    startOffset.value = offset.value;
                })
                .onUpdate((e) => {
                    'worklet';
                    const h = H.value;
                    if (!h) return;
                    const max = (count.value - 1) * h;
                    const o = startOffset.value - e.translationY;
                    if (o < 0) {
                        if (busySV.value) offset.value = Math.max(o, -HOLD);
                        else if (canRefresh.value) offset.value = -pullDisp(-o);
                        else offset.value = -rubber(-o, h);
                    } else if (o > max) {
                        offset.value = max + rubber(o - max, h);
                    } else {
                        offset.value = o;
                    }
                })
                .onEnd((e) => {
                    'worklet';
                    const h = H.value;
                    if (!h) return;
                    const n = count.value;
                    const startPage = Math.max(0, Math.round(startOffset.value / h));
                    const delta = offset.value - startPage * h;
                    const v = -e.velocityY; // + = toward the next flare

                    let dir = 0;
                    if (Math.abs(v) > FLICK_V) dir = v > 0 ? 1 : -1;
                    else if (delta > h * 0.2) dir = 1;
                    else if (delta < -h * 0.2) dir = -1;

                    const target = Math.min(n - 1, Math.max(0, startPage + dir));
                    const pulled =
                        target === 0 && startPage === 0 && !busySV.value && canRefresh.value && offset.value <= -PULL_THRESHOLD;

                    let to = target * h;
                    if (pulled) {
                        to = -HOLD;
                        runOnJS(begin)();
                    } else if (busySV.value && target === 0) {
                        to = -HOLD;
                    }

                    offset.value = withSpring(to, { ...SPRING, velocity: v });
                    runOnJS(settle)(target);
                })
                .onFinalize((_e, success) => {
                    'worklet';
                    const h = H.value;
                    if (!success && h) {
                        const page = Math.max(0, Math.round(offset.value / h));
                        offset.value = withSpring(page === 0 && busySV.value ? -HOLD : page * h, SPRING);
                    }
                }),
        [offset, startOffset, H, count, busySV, canRefresh, settle, begin],
    );

    const stackStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.value }] }));

    /* ---- misc ---- */
    useEffect(() => {
        [1, 2].forEach((o) => {
            const next = data[active + o];
            const m = next && resolveMedia(next);
            if (m?.type === 'image') Image.prefetch(m.uri).catch(() => { });
        });
    }, [active, data]);

    const handlers = useMemo<FlareHandlers>(
        () => ({
            onToggleMute: () => setMuted(!muted),
            onFollow: toggle,
            onOpenComments,
            onShare,
            onMore: setMoreFor,
            onOpenProfile: (p) => {
                if (p.isOwn) router.navigate('/(tabs)/profile');
                else if (p.author.id) openProfile(p.author.id);
            },
            onHashtag: (_tag) => {
                // TODO: open your search screen with the tag
            },
        }),
        [muted, setMuted, toggle, onOpenComments, onShare, openProfile],
    );

    const sheetActions: SheetAction[] = moreFor
        ? [
            { label: 'Not interested', Icon: EyeOff, onPress: () => setHidden((s) => new Set(s).add(moreFor.id)) },
            { label: 'Report', Icon: Flag, destructive: true, onPress: () => { /* TODO: report endpoint */ } },
        ]
        : [];

    // only previous / current / next are mounted
    const visible: number[] = [];
    for (let i = Math.max(0, active - 1); i <= Math.min(data.length - 1, active + 1); i++) visible.push(i);

    return (
        <GestureDetector gesture={pan}>
            <View className="flex-1 overflow-hidden bg-black" onLayout={(e) => setPageH(e.nativeEvent.layout.height)}>
                {pageH > 0 && data.length > 0 && (
                    // tall enough to contain every page, so Android hit-testing never clips a page
                    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: data.length * pageH }, stackStyle]}>
                        {visible.map((i) => (
                            <View
                                key={data[i].id}
                                style={{ position: 'absolute', left: 0, right: 0, top: i * pageH, height: pageH }}
                            >
                                <FlareItem
                                    post={data[i]}
                                    active={live && i === active}
                                    near
                                    pageH={pageH}
                                    muted={muted}
                                    isFollowing={following[data[i].author.id] ?? Boolean((data[i].author as any).isFollowing)}
                                    handlers={handlers}
                                />
                            </View>
                        ))}
                    </Animated.View>
                )}

                {/* pull-to-reload token: sits under the header, follows your finger */}
                <FlarePullLoader offset={offset} busy={busy} threshold={PULL_THRESHOLD} hold={HOLD} top={topChrome + 6} />

                <FlareHeader onBack={onBack} title={title} />

                <ActionSheet visible={moreFor !== null} onClose={() => setMoreFor(null)} actions={sheetActions} />
            </View>
        </GestureDetector>
    );
}