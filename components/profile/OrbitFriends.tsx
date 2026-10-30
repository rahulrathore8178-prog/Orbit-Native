import { Friend } from '@/components/profile/profile';
import { useOrbitScroll } from '@/components/profile/orbitScrollContext';
import { Search, X } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, LayoutChangeEvent, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    SharedValue,
    cancelAnimation,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDecay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    friends: Friend[];
    onOpen: (userId: string) => void;
    /** Optional fixed stage height. Normally derived so the stage ends at the screen bottom. */
    height?: number;
    /** Distance from the bottom of the screen to the bottom of the search dock (clears the floating tab bar). */
    dockBottom?: number;
};

type RO = { readonly value: number };

type Geo = {
    W: number;
    H: number;
    cx: number;
    cy: number;
    top: number;
    maxX: number;
    radii: number[];
};

/* ------------------------------ tuning knobs ------------------------------ */
const TAU = Math.PI * 2;
const NODE = 56;
const ITEM_W = 84;
const STEP = 92;
const PAD = 52;
const CLOCK_MS = 120000;
const CX_FACTOR = 1.8;
const RING_X = [0.24, 0.36, 0.48, 0.6, 0.72];
const RING_PATTERN = [1, 2, 1, 0, 2, 0];
const RING_ALPHA = [0.07, 0.16, 0.11, 0.16, 0.06];
const RING_BREATH = [8, 10, 12, 9, 11];
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
const DOCK = 48; // search icon size
const RUBBER = 0.35;
const BOTTOM_CLEARANCE = 120; // extra room above dockBottom for the last friend's avatar + name
/* -------------------------------------------------------------------------- */

const clamp01 = (v: number) => {
    'worklet';
    return v < 0 ? 0 : v > 1 ? 1 : v;
};

const band = (raw: number, total: number) => {
    'worklet';
    if (raw < 0) return raw * RUBBER;
    if (raw > total) return total + (raw - total) * RUBBER;
    return raw;
};

function layoutNode(index: number, scroll: number, g: Geo) {
    'worklet';
    const y = g.top + index * STEP - scroll;
    const dy = y - g.cy;
    const R = g.radii[1 + RING_PATTERN[index % RING_PATTERN.length]];
    const rem = R * R - dy * dy;
    const x = g.cx - Math.sqrt(rem > 0 ? rem : 0);
    const fx = clamp01((g.maxX - x) / (g.W * 0.08));
    const ft = clamp01((y + 10) / 60);
    const fb = clamp01((g.H - y + 10) / 60);
    const n = Math.min(1, Math.abs(dy) / (g.H / 2));
    return { x, y, opacity: fx * ft * fb, scale: (1 - 0.2 * n * n) * (0.88 + 0.12 * fx) };
}

/* --------------------------------- friend --------------------------------- */
const OrbitNode = memo(function OrbitNode({
    friend, index, geo, scroll, clock, show, onOpen,
}: {
    friend: Friend;
    index: number;
    geo: Geo;
    scroll: RO;
    clock: SharedValue<number>;
    show: SharedValue<number>;
    onOpen: (id: string) => void;
}) {
    const online = (friend as Friend & { online?: boolean }).online;

    const style = useAnimatedStyle(() => {
        const l = layoutNode(index, scroll.value, geo);
        // staggered pop: t goes 0..1 per node, nodes drop + shrink when hidden
        const t = clamp01(show.value * 1.4 - ((index % 5) / 5) * 0.4);
        return {
            opacity: l.opacity * t,
            transform: [
                { translateX: l.x - ITEM_W / 2 },
                { translateY: l.y - NODE / 2 + (1 - t) * 70 },
                { scale: l.scale * (0.4 + 0.6 * t) },
            ],
        };
    });

    const halo = useAnimatedStyle(() => ({
        opacity: 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(clock.value * TAU * 10 + index * 1.7)),
        transform: [{ scale: 1 + 0.05 * Math.sin(clock.value * TAU * 10 + index * 1.7) }],
    }));

    const handlePress = useCallback(() => {
        if (show.value < 0.7 || layoutNode(index, scroll.value, geo).opacity < 0.5) return;
        onOpen(friend.id);
    }, [index, scroll, geo, onOpen, friend.id, show]);

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[{ position: 'absolute', left: 0, top: 0, width: ITEM_W, alignItems: 'center' }, style]}
        >
            <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={`Open ${friend.username}`} hitSlop={6}>
                {({ pressed }) => (
                    <View style={{ alignItems: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }}>
                        <View style={{ width: NODE, height: NODE }}>
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    {
                                        position: 'absolute', left: -6, top: -6, width: NODE + 12, height: NODE + 12,
                                        borderRadius: (NODE + 12) / 2, borderWidth: 1, borderColor: '#fff',
                                    },
                                    halo,
                                ]}
                            />
                            <View
                                style={{
                                    width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5,
                                    borderColor: 'rgba(255,255,255,0.82)', backgroundColor: '#0a0a0f',
                                    shadowColor: '#fff', shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
                                }}
                            >
                                <View style={{ flex: 1, borderRadius: NODE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                    {friend.profilePic ? (
                                        <Image source={{ uri: friend.profilePic }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    ) : (
                                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600' }}>
                                            {friend.username.charAt(0).toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                                {online ? (
                                    <View
                                        style={{
                                            position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: 7,
                                            backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#000',
                                        }}
                                    />
                                ) : null}
                            </View>
                        </View>
                        <Text
                            numberOfLines={1}
                            style={{ marginTop: 8, maxWidth: ITEM_W, color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}
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
// `rev` is an extra phase that bursts forward when search opens (orbs race around),
// `fast` stretches the comet tails while the burst lasts.
const Spark = memo(function Spark({
    geo, scroll, clock, rev, fast, ring, p0, dir, mult, size, lag, alpha,
}: {
    geo: Geo; scroll: RO; clock: SharedValue<number>; rev: SharedValue<number>; fast: SharedValue<number>;
    ring: number; p0: number; dir: number; mult: number; size: number; lag: number; alpha: number;
}) {
    const style = useAnimatedStyle(() => {
        const R = geo.radii[ring];
        const half = Math.asin(Math.min(0.98, (geo.H / 2 + 20) / R));
        let p =
            p0 + dir * mult * (clock.value + rev.value) - dir * lag * (1 + 6 * fast.value) + scroll.value / (R * 3.2 * half);
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
                    position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2,
                    backgroundColor: '#fff', shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: size,
                    shadowOffset: { width: 0, height: 0 },
                },
                style,
            ]}
        />
    );
});

const Orb = memo(function Orb({
    geo, scroll, clock, rev, fast, ring, p0, dir, mult, size,
}: { geo: Geo; scroll: RO; clock: SharedValue<number>; rev: SharedValue<number>; fast: SharedValue<number> } & (typeof ORBS)[number]) {
    const common = { geo, scroll, clock, rev, fast, ring, p0, dir, mult };
    return (
        <>
            <Spark {...common} size={size} lag={0} alpha={0.9} />
            {TAIL.map((t, i) => (
                <Spark key={i} {...common} size={size * t.k} lag={t.lag} alpha={t.a} />
            ))}
        </>
    );
});

const Ring = memo(function Ring({ geo, clock, fast, i }: { geo: Geo; clock: SharedValue<number>; fast: SharedValue<number>; i: number }) {
    const R = geo.radii[i];
    const style = useAnimatedStyle(() => ({
        opacity:
            RING_ALPHA[i] * (0.7 + 0.3 * Math.sin(clock.value * TAU * RING_BREATH[i] + i * 1.3)) * (1 + 1.6 * fast.value),
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute', left: geo.cx - R, top: geo.cy - R, width: R * 2, height: R * 2,
                    borderRadius: R, borderWidth: 1, borderColor: '#fff',
                },
                style,
            ]}
        />
    );
});

const Star = memo(function Star({
    clock, rev, x, y, size, base, k, phase,
}: {
    clock: SharedValue<number>; rev: SharedValue<number>; x: number; y: number; size: number; base: number; k: number; phase: number;
}) {
    const style = useAnimatedStyle(() => ({
        opacity: base * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin((clock.value + rev.value * 0.5) * TAU * k + phase))),
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                { position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' },
                style,
            ]}
        />
    );
});

function Planet({ W, H }: { W: number; H: number }) {
    const r = W * 0.38;
    const cx = W * 1.04;
    const cy = H * 1.02;
    const disc = (radius: number, fill: string, border?: string) => (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute', left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2,
                borderRadius: radius, backgroundColor: fill, borderWidth: border ? 1 : 0, borderColor: border,
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

/* ------------------------------- search dock ------------------------------ */
// Pinned to the screen (not the scrolling page): its position is derived from the live viewport height
// minus where the stage currently sits. The keyboard height (`kb`) lifts the dock above the keyboard.
const SearchDock = memo(function SearchDock({
    W, sp, v, maxOuter, liveH, oy, kb, bottom, open, q, setQ, inputRef, onOpen, onClose,
}: {
    W: number; sp: SharedValue<number>; v: SharedValue<number>; maxOuter: SharedValue<number>;
    liveH: SharedValue<number>; oy: SharedValue<number>; kb: SharedValue<number>; bottom: number; open: boolean;
    q: string; setQ: (s: string) => void; inputRef: React.RefObject<TextInput | null>;
    onOpen: () => void; onClose: () => void;
}) {
    const wrap = useAnimatedStyle(() => {
        const outer = Math.min(Math.max(v.value, 0), maxOuter.value);
        const w = DOCK + (W - 32 - DOCK) * sp.value;
        // when the keyboard is closed kb = 0, so b === bottom (original behaviour)
        const b = Math.max(bottom, kb.value + 32);
        return {
            width: w,
            transform: [{ translateX: (W - w) / 2 }, { translateY: liveH.value - b - DOCK - (oy.value - outer) }],
        };
    });
    const inputStyle = useAnimatedStyle(() => ({ opacity: clamp01((sp.value - 0.5) / 0.5) }));
    const closeStyle = useAnimatedStyle(() => ({
        opacity: clamp01((sp.value - 0.6) / 0.4),
        transform: [{ scale: 0.6 + 0.4 * clamp01((sp.value - 0.6) / 0.4) }],
    }));

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute', left: 0, top: 0, height: DOCK, borderRadius: DOCK / 2, overflow: 'hidden',
                    backgroundColor: 'rgba(16,16,24,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                    shadowColor: '#fff', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
                },
                wrap,
            ]}
        >
            <Pressable
                disabled={open}
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel="Search friends"
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            >
                <View style={{ width: DOCK - 2, height: DOCK, alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={20} color="#fff" />
                </View>
                <Animated.View style={[{ flex: 1 }, inputStyle]} pointerEvents={open ? 'auto' : 'none'}>
                    <TextInput
                        ref={inputRef}
                        value={q}
                        onChangeText={setQ}
                        placeholder="Search friends"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        selectionColor="#fff"
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                        style={{ height: DOCK, color: '#fff', fontSize: 15, paddingVertical: 0 }}
                    />
                </Animated.View>
                <Animated.View style={closeStyle} pointerEvents={open ? 'auto' : 'none'}>
                    <Pressable onPress={onClose} hitSlop={8} style={{ width: DOCK - 6, height: DOCK, alignItems: 'center', justifyContent: 'center' }}>
                        <X size={18} color="rgba(255,255,255,0.85)" />
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Animated.View>
    );
});

/* ---------------------------------- stage --------------------------------- */
export default function OrbitFriends({ friends, onOpen, height, dockBottom = 96 }: Props) {
    const ctx = useOrbitScroll();
    const win = useWindowDimensions();
    const [W, setW] = useState(0);
    const [first, setFirst] = useState(0);
    const [stageY, setStageY] = useState<number | null>(null); // stage top inside the page content
    const [searching, setSearching] = useState(false);
    const [q, setQ] = useState('');
    const rootRef = useRef<View>(null);
    const inputRef = useRef<TextInput>(null);

    // standalone fallbacks so the component still works without the profile provider
    const lv = useSharedValue(0);
    const lmo = useSharedValue(0);
    const lmi = useSharedValue(0);
    const ldr = useSharedValue(false);
    const llive = useSharedValue(0);
    const ltop = useSharedValue(0);
    const v = ctx?.v ?? lv;
    const maxOuter = ctx?.maxOuter ?? lmo;
    const maxInner = ctx?.maxInner ?? lmi;
    const driving = ctx?.driving ?? ldr;
    const liveH = ctx?.liveH ?? llive;
    const topWin = ctx?.topWin ?? ltop;

    const startV = useSharedValue(0);
    const clock = useSharedValue(0);
    const rev = useSharedValue(0); // extra orbit phase (search bursts)
    const fast = useSharedValue(0); // 0..1 speed feel (tails, ring glow)
    const show = useSharedValue(1); // 1 = friends visible, 0 = popped down
    const sp = useSharedValue(0); // search dock open progress
    const oy = useSharedValue(0);
    const kb = useSharedValue(0); // keyboard height (lifts the search dock above the keyboard)

    // inner (orbit) scroll derived from the single virtual scroll
    const scroll = useDerivedValue(() => (v.value < 0 ? v.value : Math.max(0, v.value - maxOuter.value)));

    const setActive = ctx?.setActive;
    useEffect(() => {
        setActive?.(true);
        return () => setActive?.(false);
    }, [setActive]);

    /* ---- keyboard ---- */
    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const s = Keyboard.addListener(showEvt, (e) => {
            kb.value = withTiming(e.endCoordinates.height, {
                duration: e.duration || 250,
                easing: Easing.out(Easing.cubic),
            });
        });
        const h = Keyboard.addListener(hideEvt, (e) => {
            kb.value = withTiming(0, { duration: e?.duration || 220, easing: Easing.out(Easing.cubic) });
        });
        return () => {
            s.remove();
            h.remove();
        };
    }, [kb]);

    /* ---- search ---- */
    const list = useMemo(() => {
        if (!searching) return friends;
        const s = q.trim().toLowerCase();
        return s ? friends.filter((f) => f.username.toLowerCase().includes(s)) : [];
    }, [friends, searching, q]);
    const n = list.length;
    const shown = !searching || (q.trim().length > 0 && n > 0);

    const burst = useCallback(
        (amount: number, dur: number) => {
            rev.value = withTiming(rev.value + amount, { duration: dur, easing: Easing.inOut(Easing.cubic) });
            fast.value = withSequence(
                withTiming(1, { duration: dur * 0.3, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: dur * 0.7, easing: Easing.inOut(Easing.quad) })
            );
        },
        [rev, fast]
    );

    useEffect(() => {
        show.value = shown
            ? withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })
            : withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) });
    }, [shown, show]);

    // every new query (and the first mount) replays a pop-in for the visible set
    useEffect(() => {
        if (!shown) return;
        show.value = 0;
        show.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
        if (searching) burst(0.7, 900);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const openSearch = useCallback(() => {
        setSearching(true);
        sp.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1) });
        burst(3, 1700);
        cancelAnimation(v);
        v.value = withTiming(Math.min(v.value, maxOuter.value), { duration: 500 }); // orbit back to the top while friends are hidden
        setTimeout(() => inputRef.current?.focus(), 300);
    }, [sp, burst, v, maxOuter]);

    const closeSearch = useCallback(() => {
        Keyboard.dismiss();
        setQ('');
        setSearching(false);
        sp.value = withTiming(0, { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) });
        burst(2.2, 1400);
    }, [sp, burst]);

    /* ---- layout ---- */
    const measure = useCallback(() => {
        if (!ctx) return;
        rootRef.current?.measureInWindow((_x, y) => {
            const outer = Math.min(Math.max(v.value, 0), maxOuter.value);
            const next = Math.round(y - topWin.value + outer);
            setStageY((p) => (p !== null && Math.abs(p - next) < 2 ? p : next));
        });
    }, [ctx, v, maxOuter, topWin]);

    useEffect(() => {
        measure();
        const t = setTimeout(measure, 700); // after the Reveal intro animation settles
        return () => clearTimeout(t);
    }, [measure, W]);

    const fallbackH = Math.round(Math.min(Math.max(win.height * 0.62, 440), 680));
    const H =
        height ??
        (ctx && ctx.viewportH > 0 && stageY !== null
            ? Math.max(360, Math.round(ctx.viewportH - (stageY - ctx.collapseAt)))
            : fallbackH);

    useEffect(() => { oy.value = stageY ?? 0; }, [stageY, oy]);
    useEffect(() => { if (!ctx) llive.value = H; }, [ctx, H, llive]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setW((prev) => (prev === w ? prev : w));
    }, []);

    useEffect(() => {
        clock.value = withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false);
        return () => cancelAnimation(clock);
    }, [clock]);

    const { geo, innerMax } = useMemo(() => {
        const cx = CX_FACTOR * W;
        const span = Math.max(0, (n - 1) * STEP);

        // space the floating tab bar + search button cover at the bottom of the stage;
        // the last friend (avatar + name) comes to rest above it
        const bottomPad = Math.max(PAD, dockBottom + BOTTOM_CLEARANCE);
        const usable = H - PAD - bottomPad;

        const can = span > usable;
        const g: Geo = {
            W, H, cx, cy: H / 2,
            // short lists: centre them inside the clear area instead of the full stage
            top: can ? PAD : PAD + (usable - span) / 2,
            maxX: W * 0.93,
            radii: RING_X.map((f) => cx - f * W),
        };
        return { geo: g, innerMax: can ? span - usable : 0 };
    }, [W, H, n, dockBottom]);

    useEffect(() => {
        maxInner.value = innerMax;
        const total = maxOuter.value + innerMax;
        if (v.value > total) v.value = withTiming(total, { duration: 300 });
    }, [innerMax, maxInner, maxOuter, v]);

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

    useAnimatedReaction(
        () => Math.max(0, Math.floor(scroll.value / STEP)),
        (cur, prev) => {
            if (cur !== prev) runOnJS(setFirst)(cur);
        }
    );

    // Always enabled: even with one friend you can drag, stretch and spring back.
    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetY([-8, 8])
                .failOffsetX([-28, 28]) // horizontal swipes still go to the tab pager
                .onBegin(() => {
                    cancelAnimation(v);
                    driving.value = true;
                })
                .onStart(() => {
                    startV.value = v.value;
                })
                .onUpdate((e) => {
                    v.value = band(startV.value - e.translationY, maxOuter.value + maxInner.value);
                })
                .onEnd((e) => {
                    v.value = withDecay(
                        {
                            velocity: -e.velocityY,
                            clamp: [0, maxOuter.value + maxInner.value],
                            rubberBandEffect: true,
                            rubberBandFactor: 0.6,
                            deceleration: 0.997,
                        },
                        (finished) => {
                            if (finished) driving.value = false;
                        }
                    );
                })
                .onFinalize((_e, success) => {
                    if (!success) driving.value = false;
                }),
        [v, startV, driving, maxOuter, maxInner]
    );

    if (friends.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No friends yet.</Text>;
    }

    const from = Math.max(0, first - 3);
    const to = Math.min(n - 1, first + Math.ceil(H / STEP) + 4);
    const visible: React.ReactNode[] = [];
    if (W > 0) {
        for (let i = from; i <= to; i++) {
            visible.push(
                <OrbitNode key={list[i].id} friend={list[i]} index={i} geo={geo} scroll={scroll} clock={clock} show={show} onOpen={onOpen} />
            );
        }
    }

    return (
        <GestureDetector gesture={pan}>
            <View
                ref={rootRef}
                collapsable={false}
                onLayout={(e) => {
                    onLayout(e);
                    measure();
                }}
                style={{ width: '100%', height: H, backgroundColor: '#000', overflow: 'hidden' }}
            >
                {W > 0 && (
                    <>
                        <Planet W={W} H={H} />
                        {stars.map((s, i) => (
                            <Star key={i} clock={clock} rev={rev} {...s} />
                        ))}
                        {geo.radii.map((_, i) => (
                            <Ring key={i} geo={geo} clock={clock} fast={fast} i={i} />
                        ))}
                        {ORBS.map((o, i) => (
                            <Orb key={i} geo={geo} scroll={scroll} clock={clock} rev={rev} fast={fast} {...o} />
                        ))}
                        {visible}

                        {searching && !shown && (
                            <Animated.View
                                entering={FadeIn.duration(300).delay(200)}
                                exiting={FadeOut.duration(150)}
                                pointerEvents="none"
                                style={{ position: 'absolute', left: 0, right: 0, top: H * 0.38, alignItems: 'center' }}
                            >
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, letterSpacing: 0.3 }}>
                                    {q.trim() ? 'No friends match' : 'Type a name to call them back'}
                                </Text>
                            </Animated.View>
                        )}

                        <SearchDock
                            W={W}
                            sp={sp}
                            v={v}
                            maxOuter={maxOuter}
                            liveH={liveH}
                            oy={oy}
                            kb={kb}
                            bottom={dockBottom}
                            open={searching}
                            q={q}
                            setQ={setQ}
                            inputRef={inputRef}
                            onOpen={openSearch}
                            onClose={closeSearch}
                        />
                    </>
                )}
            </View>
        </GestureDetector>
    );
}