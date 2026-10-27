import { Friend } from '@/components/profile/profile';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    SharedValue,
    cancelAnimation,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDecay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    friends: Friend[];
    onOpen: (userId: string) => void;
    /** Optional fixed height of the orbit stage. Defaults to ~62% of the window. */
    height?: number;
};

type Geo = {
    W: number;
    H: number;
    cx: number; // centre of every ring (off-screen, on the RIGHT)
    cy: number;
    top: number; // y of the first friend at scroll = 0
    maxX: number; // friends fade out to the right of this x
    radii: number[];
};

/* ------------------------------ tuning knobs ------------------------------ */
const TAU = Math.PI * 2;
const NODE = 56; // avatar size
const ITEM_W = 84; // avatar + label width
const STEP = 92; // vertical distance between friends
const PAD = 52; // top / bottom breathing room
const CLOCK_MS = 120000; // one full "ambient" cycle (everything alive loops on this)
const CX_FACTOR = 1.8; // ring centre = CX_FACTOR * width  (bigger = flatter arcs)
// leftmost x of each ring as a fraction of the stage width (rings 1..3 carry friends)
const RING_X = [0.24, 0.36, 0.48, 0.6, 0.72];
const RING_PATTERN = [1, 2, 1, 0, 2, 0]; // which carrying ring friend i sits on
const RING_ALPHA = [0.07, 0.16, 0.11, 0.16, 0.06];
const RING_BREATH = [8, 10, 12, 9, 11]; // breaths per CLOCK_MS (integers => seamless loop)
// drifting light orbs: ring, start position on arc (0..1), direction, speed (crossings per 2 clocks)
const ORBS = [
    { ring: 0, p0: 0.1, dir: 1, mult: 2, size: 6 },
    { ring: 0, p0: 0.62, dir: 1, mult: 2, size: 4 },
    { ring: 1, p0: 0.35, dir: -1, mult: 1, size: 7 },
    { ring: 2, p0: 0.8, dir: 1, mult: 1, size: 5 },
    { ring: 3, p0: 0.2, dir: -1, mult: 2, size: 6 },
    { ring: 3, p0: 0.7, dir: 1, mult: 1, size: 4 },
    { ring: 4, p0: 0.45, dir: -1, mult: 1, size: 7 },
    { ring: 4, p0: 0.95, dir: 1, mult: 2, size: 5 },
];
const TAIL = [
    { lag: 0.016, k: 0.75, a: 0.45 },
    { lag: 0.032, k: 0.55, a: 0.25 },
    { lag: 0.048, k: 0.38, a: 0.12 },
];
/* -------------------------------------------------------------------------- */

const clamp01 = (v: number) => {
    'worklet';
    return v < 0 ? 0 : v > 1 ? 1 : v;
};

// Single source of truth for where a friend sits (UI thread animation + JS thread tap guard).
function layoutNode(index: number, scroll: number, g: Geo) {
    'worklet';
    const y = g.top + index * STEP - scroll;
    const dy = y - g.cy;
    const R = g.radii[1 + RING_PATTERN[index % RING_PATTERN.length]];
    const rem = R * R - dy * dy;
    const x = g.cx - Math.sqrt(rem > 0 ? rem : 0); // point on the ring at this height
    const fx = clamp01((g.maxX - x) / (g.W * 0.08));
    const ft = clamp01((y + 10) / 60);
    const fb = clamp01((g.H - y + 10) / 60);
    const n = Math.min(1, Math.abs(dy) / (g.H / 2));
    return {
        x,
        y,
        opacity: fx * ft * fb,
        scale: (1 - 0.2 * n * n) * (0.88 + 0.12 * fx),
    };
}

/* --------------------------------- friend --------------------------------- */
const OrbitNode = memo(function OrbitNode({
    friend,
    index,
    geo,
    scroll,
    clock,
    onOpen,
}: {
    friend: Friend;
    index: number;
    geo: Geo;
    scroll: SharedValue<number>;
    clock: SharedValue<number>;
    onOpen: (id: string) => void;
}) {
    const online = (friend as Friend & { online?: boolean }).online;

    const style = useAnimatedStyle(() => {
        const l = layoutNode(index, scroll.value, geo);
        return {
            opacity: l.opacity,
            transform: [
                { translateX: l.x - ITEM_W / 2 },
                { translateY: l.y - NODE / 2 },
                { scale: l.scale },
            ],
        };
    });

    // soft halo that slowly breathes, every friend on its own phase
    const halo = useAnimatedStyle(() => ({
        opacity: 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(clock.value * TAU * 10 + index * 1.7)),
        transform: [{ scale: 1 + 0.05 * Math.sin(clock.value * TAU * 10 + index * 1.7) }],
    }));

    const handlePress = useCallback(() => {
        if (layoutNode(index, scroll.value, geo).opacity < 0.5) return;
        onOpen(friend.id);
    }, [index, scroll, geo, onOpen, friend.id]);

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[{ position: 'absolute', left: 0, top: 0, width: ITEM_W, alignItems: 'center' }, style]}
        >
            <Pressable
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel={`Open ${friend.username}`}
                hitSlop={6}
            >
                {({ pressed }) => (
                    <View style={{ alignItems: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }}>
                        <View style={{ width: NODE, height: NODE }}>
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    {
                                        position: 'absolute',
                                        left: -6,
                                        top: -6,
                                        width: NODE + 12,
                                        height: NODE + 12,
                                        borderRadius: (NODE + 12) / 2,
                                        borderWidth: 1,
                                        borderColor: '#fff',
                                    },
                                    halo,
                                ]}
                            />
                            <View
                                style={{
                                    width: NODE,
                                    height: NODE,
                                    borderRadius: NODE / 2,
                                    borderWidth: 1.5,
                                    borderColor: 'rgba(255,255,255,0.82)',
                                    backgroundColor: '#0a0a0f',
                                    shadowColor: '#fff',
                                    shadowOpacity: 0.32,
                                    shadowRadius: 12,
                                    shadowOffset: { width: 0, height: 0 },
                                }}
                            >
                                <View
                                    style={{
                                        flex: 1,
                                        borderRadius: NODE / 2,
                                        overflow: 'hidden',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {friend.profilePic ? (
                                        <Image
                                            source={{ uri: friend.profilePic }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600' }}>
                                            {friend.username.charAt(0).toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                                {online ? (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            right: -2,
                                            bottom: -2,
                                            width: 13,
                                            height: 13,
                                            borderRadius: 7,
                                            backgroundColor: '#22c55e',
                                            borderWidth: 2,
                                            borderColor: '#000',
                                        }}
                                    />
                                ) : null}
                            </View>
                        </View>
                        <Text
                            numberOfLines={1}
                            style={{
                                marginTop: 8,
                                maxWidth: ITEM_W,
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: 12,
                                fontWeight: '600',
                                letterSpacing: 0.3,
                            }}
                        >
                            {friend.username}
                        </Text>
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
});

/* ----------------------- living background elements ----------------------- */
// One soft white light on a ring (head or a fading tail dot). It travels along the visible
// part of the arc, fades in/out at both ends and keeps drifting with the scroll (parallax).
const Spark = memo(function Spark({
    geo,
    scroll,
    clock,
    ring,
    p0,
    dir,
    mult,
    size,
    lag,
    alpha,
}: {
    geo: Geo;
    scroll: SharedValue<number>;
    clock: SharedValue<number>;
    ring: number;
    p0: number;
    dir: number;
    mult: number;
    size: number;
    lag: number;
    alpha: number;
}) {
    const style = useAnimatedStyle(() => {
        const R = geo.radii[ring];
        const half = Math.asin(Math.min(0.98, (geo.H / 2 + 20) / R));
        let p = p0 + dir * mult * clock.value - dir * lag + scroll.value / (R * 3.2 * half);
        p = p - Math.floor(p);
        const th = Math.PI + (p - 0.5) * 2 * half;
        const x = geo.cx + R * Math.cos(th);
        const y = geo.cy + R * Math.sin(th);
        return {
            opacity: alpha * Math.sin(Math.PI * p) * clamp01((geo.maxX - x) / (geo.W * 0.08)),
            transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
        };
    });
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#fff',
                    shadowColor: '#fff',
                    shadowOpacity: 0.9,
                    shadowRadius: size,
                    shadowOffset: { width: 0, height: 0 },
                },
                style,
            ]}
        />
    );
});

const Orb = memo(function Orb({
    geo,
    scroll,
    clock,
    ring,
    p0,
    dir,
    mult,
    size,
}: { geo: Geo; scroll: SharedValue<number>; clock: SharedValue<number> } & (typeof ORBS)[number]) {
    const common = { geo, scroll, clock, ring, p0, dir, mult };
    return (
        <>
            <Spark {...common} size={size} lag={0} alpha={0.9} />
            {TAIL.map((t, i) => (
                <Spark key={i} {...common} size={size * t.k} lag={t.lag} alpha={t.a} />
            ))}
        </>
    );
});

const Ring = memo(function Ring({
    geo,
    clock,
    i,
}: {
    geo: Geo;
    clock: SharedValue<number>;
    i: number;
}) {
    const R = geo.radii[i];
    const style = useAnimatedStyle(() => ({
        opacity: RING_ALPHA[i] * (0.7 + 0.3 * Math.sin(clock.value * TAU * RING_BREATH[i] + i * 1.3)),
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    left: geo.cx - R,
                    top: geo.cy - R,
                    width: R * 2,
                    height: R * 2,
                    borderRadius: R,
                    borderWidth: 1,
                    borderColor: '#fff',
                },
                style,
            ]}
        />
    );
});

const Star = memo(function Star({
    clock,
    x,
    y,
    size,
    base,
    k,
    phase,
}: {
    clock: SharedValue<number>;
    x: number;
    y: number;
    size: number;
    base: number;
    k: number;
    phase: number;
}) {
    const style = useAnimatedStyle(() => ({
        opacity: base * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(clock.value * TAU * k + phase))),
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#fff',
                },
                style,
            ]}
        />
    );
});

// Quiet planet in the bottom-right corner (static, layered translucent discs = soft glow).
function Planet({ W, H }: { W: number; H: number }) {
    const r = W * 0.38;
    const cx = W * 1.04;
    const cy = H * 1.02;
    const disc = (radius: number, fill: string, border?: string) => (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: cx - radius,
                top: cy - radius,
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                backgroundColor: fill,
                borderWidth: border ? 1 : 0,
                borderColor: border,
            }}
        />
    );
    return (
        <>
            {disc(r * 1.55, 'rgba(255,255,255,0.008)')}
            {disc(r * 1.3, 'rgba(255,255,255,0.014)')}
            {disc(r * 1.12, 'rgba(255,255,255,0.02)')}
            {disc(r, '#050509', 'rgba(255,255,255,0.16)')}
        </>
    );
}

/* ---------------------------------- stage --------------------------------- */
export default function OrbitFriends({ friends, onOpen, height }: Props) {
    const win = useWindowDimensions();
    const H = height ?? Math.round(Math.min(Math.max(win.height * 0.62, 440), 680));
    const [W, setW] = useState(0);
    const [first, setFirst] = useState(0);
    const scroll = useSharedValue(0);
    const startY = useSharedValue(0);
    const clock = useSharedValue(0);
    const n = friends.length;

    // ambient clock: everything "alive" (orbs, halos, ring breathing, twinkling) hangs off this
    useEffect(() => {
        clock.value = withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false);
        return () => cancelAnimation(clock);
    }, [clock]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setW((prev) => (prev === w ? prev : w));
    }, []);

    const { geo, maxScroll, canScroll } = useMemo(() => {
        const cx = CX_FACTOR * W;
        const span = Math.max(0, (n - 1) * STEP);
        const usable = H - 2 * PAD;
        const can = span > usable;
        const g: Geo = {
            W,
            H,
            cx,
            cy: H / 2,
            top: can ? PAD : (H - span) / 2, // few friends -> centred, no scrolling
            maxX: W * 0.93,
            radii: RING_X.map((f) => cx - f * W),
        };
        return { geo: g, maxScroll: can ? span - usable : 0, canScroll: can };
    }, [W, H, n]);

    const stars = useMemo(() => {
        let s = 7;
        const rnd = () => {
            s = (s * 16807) % 2147483647;
            return s / 2147483647;
        };
        return Array.from({ length: 18 }, () => ({
            x: W * (0.2 + 0.8 * rnd()),
            y: H * rnd(),
            size: 1.2 + rnd() * 1.6,
            base: 0.25 + rnd() * 0.45,
            k: 12 + Math.floor(rnd() * 18),
            phase: rnd() * TAU,
        }));
    }, [W, H]);

    useEffect(() => {
        if (scroll.value > maxScroll) scroll.value = maxScroll;
    }, [maxScroll, scroll]);

    // Only mount the friends near the viewport; positions are computed from absolute index.
    useAnimatedReaction(
        () => Math.max(0, Math.floor(scroll.value / STEP)),
        (cur, prev) => {
            if (cur !== prev) runOnJS(setFirst)(cur);
        }
    );

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .enabled(canScroll)
                .activeOffsetY([-8, 8])
                .onBegin(() => {
                    cancelAnimation(scroll); // touching the orbit stops its momentum
                })
                .onStart(() => {
                    startY.value = scroll.value;
                })
                .onUpdate((e) => {
                    const raw = startY.value - e.translationY;
                    if (raw < 0) scroll.value = raw * 0.35; // rubber band
                    else if (raw > maxScroll) scroll.value = maxScroll + (raw - maxScroll) * 0.35;
                    else scroll.value = raw;
                })
                .onEnd((e) => {
                    scroll.value = withDecay({
                        velocity: -e.velocityY,
                        clamp: [0, maxScroll],
                        rubberBandEffect: true,
                        rubberBandFactor: 0.6,
                        deceleration: 0.997,
                    });
                }),
        [canScroll, maxScroll, scroll, startY]
    );

    if (n === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No friends yet.</Text>;
    }

    const from = Math.max(0, first - 3);
    const to = Math.min(n - 1, first + Math.ceil(H / STEP) + 4);
    const visible: React.ReactNode[] = [];
    if (W > 0) {
        for (let i = from; i <= to; i++) {
            visible.push(
                <OrbitNode
                    key={friends[i].id}
                    friend={friends[i]}
                    index={i}
                    geo={geo}
                    scroll={scroll}
                    clock={clock}
                    onOpen={onOpen}
                />
            );
        }
    }

    return (
        <GestureDetector gesture={pan}>
            <View onLayout={onLayout} style={{ width: '100%', height: H, backgroundColor: '#000', overflow: 'hidden' }}>
                {W > 0 && (
                    <>
                        <Planet W={W} H={H} />
                        {stars.map((s, i) => (
                            <Star key={i} clock={clock} {...s} />
                        ))}
                        {geo.radii.map((_, i) => (
                            <Ring key={i} geo={geo} clock={clock} i={i} />
                        ))}
                        {ORBS.map((o, i) => (
                            <Orb key={i} geo={geo} scroll={scroll} clock={clock} {...o} />
                        ))}
                        {visible}
                    </>
                )}
            </View>
        </GestureDetector>
    );
}