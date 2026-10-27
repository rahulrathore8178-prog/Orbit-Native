import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, memo, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    FadeInDown,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

/* ------------------------------ theme --------------------------------- */

export const C = {
    bg: '#05070C',
    card: 'rgba(16,20,28,0.74)',
    border: 'rgba(255,255,255,0.09)',
    field: '#0B0F16',
    text: '#E7EAEF',
    mute: '#8891A0',
    dim: '#5B6472',
    accent: '#6D8BFF',
    accent2: '#9B7BFF',
    danger: '#F2939A',
    ok: '#6EE7B7',
};

/** Staggered entrance for the n-th block on a screen. */
export const enter = (i: number) =>
    FadeInDown.delay(60 + i * 70).duration(460).easing(Easing.out(Easing.cubic));

const tap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
};

/* ------------------------------ rings --------------------------------- */

type RingCfg = {
    d: number;
    dur: number;
    rev?: boolean;
    dots: number[]; // angles in degrees
    dot: number;
    color: string;
    dotColor: string;
};

const Ring = memo(function Ring({ parent, cfg }: { parent: number; cfg: RingCfg }) {
    const rot = useSharedValue(0);

    useEffect(() => {
        rot.value = 0;
        rot.value = withRepeat(
            withTiming(cfg.rev ? -360 : 360, { duration: cfg.dur, easing: Easing.linear }),
            -1,
            false,
        );
        return () => cancelAnimation(rot);
    }, [cfg.dur, cfg.rev, rot]);

    const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
    const r = cfg.d / 2 - 1;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    top: (parent - cfg.d) / 2,
                    left: (parent - cfg.d) / 2,
                    width: cfg.d,
                    height: cfg.d,
                    borderRadius: cfg.d / 2,
                    borderWidth: 1,
                    borderColor: cfg.color,
                },
                style,
            ]}
        >
            {cfg.dots.map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const cx = r + r * Math.sin(rad);
                const cy = r - r * Math.cos(rad);
                const halo = cfg.dot * 2.8;
                return (
                    <React.Fragment key={deg}>
                        <View
                            style={{
                                position: 'absolute',
                                left: cx - halo / 2,
                                top: cy - halo / 2,
                                width: halo,
                                height: halo,
                                borderRadius: halo / 2,
                                backgroundColor: cfg.dotColor,
                                opacity: 0.18,
                            }}
                        />
                        <View
                            style={{
                                position: 'absolute',
                                left: cx - cfg.dot / 2,
                                top: cy - cfg.dot / 2,
                                width: cfg.dot,
                                height: cfg.dot,
                                borderRadius: cfg.dot / 2,
                                backgroundColor: cfg.dotColor,
                                shadowColor: cfg.dotColor,
                                shadowOpacity: 0.9,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 0 },
                            }}
                        />
                    </React.Fragment>
                );
            })}
        </Animated.View>
    );
});

/** Three revolving rings (different speeds/directions) around whatever you put inside. */
export const OrbitRings = memo(function OrbitRings({
    size,
    children,
}: {
    size: number;
    children?: React.ReactNode;
}) {
    const rings = useMemo<RingCfg[]>(
        () => [
            { d: size, dur: 28000, dots: [20, 200], dot: 6, color: 'rgba(109,139,255,0.28)', dotColor: C.accent },
            { d: size * 0.8, dur: 19000, rev: true, dots: [110], dot: 5, color: 'rgba(155,123,255,0.25)', dotColor: C.accent2 },
            { d: size * 0.6, dur: 12500, dots: [280], dot: 4, color: 'rgba(255,255,255,0.14)', dotColor: '#fff' },
        ],
        [size],
    );
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {rings.map((cfg, i) => (
                <Ring key={i} parent={size} cfg={cfg} />
            ))}
            {children}
        </View>
    );
});

/** A little glowing planet. Used as the logo mark. */
export const OrbitCore = memo(function OrbitCore({ size = 54 }: { size?: number }) {
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.halo, { width: size * 2.2, height: size * 2.2, borderRadius: size * 1.1, opacity: 0.07 }]} />
            <View style={[styles.halo, { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8, opacity: 0.12 }]} />
            <LinearGradient
                colors={[C.accent, C.accent2]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    shadowColor: C.accent,
                    shadowOpacity: 0.7,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 10,
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    top: size * 0.16,
                    left: size * 0.18,
                    width: size * 0.3,
                    height: size * 0.3,
                    borderRadius: size * 0.15,
                    backgroundColor: 'rgba(255,255,255,0.28)',
                }}
            />
        </View>
    );
});

/* ----------------------------- backdrop ------------------------------- */

const STARS = Array.from({ length: 44 }, (_, i) => ({
    x: ((i * 47) % 97) + 1.5,
    y: ((i * 29 + 13 * i * i) % 96) + 2,
    s: i % 5 === 0 ? 2 : 1,
    g: i % 2,
}));

const StarLayer = memo(function StarLayer({ group, duration }: { group: number; duration: number }) {
    const o = useSharedValue(0.9);
    useEffect(() => {
        o.value = withRepeat(
            withSequence(withTiming(0.2, { duration }), withTiming(0.9, { duration })),
            -1,
            false,
        );
        return () => cancelAnimation(o);
    }, [duration, o]);
    const style = useAnimatedStyle(() => ({ opacity: o.value }));
    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
            {STARS.filter((s) => s.g === group).map((s, i) => (
                <View
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: s.s,
                        height: s.s,
                        borderRadius: 1,
                        backgroundColor: '#fff',
                        opacity: s.s === 2 ? 0.7 : 0.45,
                    }}
                />
            ))}
        </Animated.View>
    );
});

/** Deep-space background: gradient, twinkling stars and two huge slow orbits in the corners. */
export const OrbitBackdrop = memo(function OrbitBackdrop() {
    const { width } = useWindowDimensions();
    const big = Math.round(width * 1.5);
    const a = useMemo<RingCfg>(
        () => ({ d: big, dur: 120000, dots: [40], dot: 6, color: 'rgba(109,139,255,0.10)', dotColor: C.accent }),
        [big],
    );
    const b = useMemo<RingCfg>(
        () => ({ d: big, dur: 150000, rev: true, dots: [220], dot: 5, color: 'rgba(155,123,255,0.09)', dotColor: C.accent2 }),
        [big],
    );
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={['#0A0E1A', C.bg, '#0C0A1A']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
            />
            <StarLayer group={0} duration={2600} />
            <StarLayer group={1} duration={3600} />
            <View style={{ position: 'absolute', top: -big * 0.62, right: -big * 0.55, width: big, height: big }}>
                <Ring parent={big} cfg={a} />
            </View>
            <View style={{ position: 'absolute', bottom: -big * 0.6, left: -big * 0.6, width: big, height: big }}>
                <Ring parent={big} cfg={b} />
            </View>
        </View>
    );
});

/* ------------------------------ glass --------------------------------- */

export const GlassCard = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.card}>
        <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
            style={styles.cardSheen}
        />
        {children}
    </View>
);

/* ------------------------------ input --------------------------------- */

type InputProps = TextInputProps & {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    error?: boolean;
    secureToggle?: boolean;
};

export const OrbitInput = memo(
    forwardRef<TextInput, InputProps>(function OrbitInput(
        { label, icon, error, secureToggle, value = '', multiline, onFocus, onBlur, secureTextEntry, ...rest },
        ref,
    ) {
        const [focused, setFocused] = useState(false);
        const [hidden, setHidden] = useState(true);
        const focus = useSharedValue(0);
        const float = useSharedValue(value ? 1 : 0);

        useEffect(() => {
            focus.value = withTiming(focused ? 1 : 0, { duration: 180 });
        }, [focused, focus]);
        useEffect(() => {
            float.value = withTiming(focused || value.length > 0 ? 1 : 0, { duration: 170 });
        }, [focused, value, float]);

        const boxStyle = useAnimatedStyle(() => ({
            borderColor: interpolateColor(focus.value, [0, 1], ['rgba(255,255,255,0.08)', C.accent]),
            shadowOpacity: focus.value * 0.35,
        }));
        const labelStyle = useAnimatedStyle(() => ({
            color: interpolateColor(focus.value, [0, 1], [C.dim, '#9DB2FF']),
            transform: [
                { translateY: interpolate(float.value, [0, 1], [0, -11]) },
                { scale: interpolate(float.value, [0, 1], [1, 0.76]) },
            ],
        }));

        const padL = icon ? 44 : 16;
        return (
            <Animated.View
                style={[styles.field, multiline && { minHeight: 108 }, boxStyle, error && { borderColor: C.danger }]}
            >
                {icon ? (
                    <Ionicons
                        name={icon}
                        size={18}
                        color={focused ? C.accent : C.dim}
                        style={{ position: 'absolute', left: 16, top: 19 }}
                    />
                ) : null}
                <Animated.Text
                    pointerEvents="none"
                    style={[styles.label, { left: padL, transformOrigin: 'left center' } as any, labelStyle]}
                >
                    {label}
                </Animated.Text>
                <TextInput
                    ref={ref}
                    value={value}
                    multiline={multiline}
                    selectionColor={C.accent}
                    cursorColor={C.accent}
                    secureTextEntry={secureToggle ? hidden : secureTextEntry}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                    style={[
                        styles.input,
                        { paddingLeft: padL, paddingRight: secureToggle ? 48 : 16 },
                        multiline && { minHeight: 108, paddingTop: 26, textAlignVertical: 'top' },
                    ]}
                    {...rest}
                />
                {secureToggle ? (
                    <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.eye}>
                        <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={C.dim} />
                    </Pressable>
                ) : null}
            </Animated.View>
        );
    }),
);

/* ----------------------------- buttons -------------------------------- */

export const PrimaryButton = memo(function PrimaryButton({
    title,
    onPress,
    loading,
    disabled,
}: {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
}) {
    const s = useSharedValue(1);
    const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
    const off = Boolean(disabled || loading);
    return (
        <Animated.View style={[styles.btnShadow, a, disabled && !loading && { opacity: 0.45 }]}>
            <Pressable
                disabled={off}
                onPress={() => { tap(); onPress(); }}
                onPressIn={() => { s.value = withSpring(0.97, { damping: 15, stiffness: 320 }); }}
                onPressOut={() => { s.value = withSpring(1, { damping: 12, stiffness: 260 }); }}
            >
                <LinearGradient colors={[C.accent, C.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{title}</Text>}
                </LinearGradient>
            </Pressable>
        </Animated.View>
    );
});

export const GoogleButton = memo(function GoogleButton({
    onPress,
    loading,
    disabled,
    label = 'Continue with Google',
}: {
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    label?: string;
}) {
    const s = useSharedValue(1);
    const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
    const off = Boolean(disabled || loading);
    return (
        <Animated.View style={[a, disabled && !loading && { opacity: 0.45 }]}>
            <Pressable
                disabled={off}
                onPress={() => { tap(); onPress(); }}
                onPressIn={() => { s.value = withSpring(0.97, { damping: 15, stiffness: 320 }); }}
                onPressOut={() => { s.value = withSpring(1, { damping: 12, stiffness: 260 }); }}
                style={styles.googleBtn}
            >
                {loading ? (
                    <ActivityIndicator color={C.text} />
                ) : (
                    <>
                        <Ionicons name="logo-google" size={18} color={C.text} />
                        <Text style={styles.googleText}>{label}</Text>
                    </>
                )}
            </Pressable>
        </Animated.View>
    );
});

/* ------------------------------ misc ---------------------------------- */

export const Divider = ({ text = 'or continue with' }: { text?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>{text}</Text>
        <View style={styles.line} />
    </View>
);

export const ErrorBanner = ({ message }: { message?: string }) => {
    const x = useSharedValue(0);
    useEffect(() => {
        if (!message) return;
        x.value = withSequence(
            withTiming(-6, { duration: 50 }),
            withTiming(6, { duration: 70 }),
            withTiming(-4, { duration: 60 }),
            withTiming(0, { duration: 50 }),
        );
    }, [message, x]);
    const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    if (!message) return null;
    return (
        <Animated.View entering={FadeInDown.duration(220)} style={[styles.error, style]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{message}</Text>
        </Animated.View>
    );
};

/** 4-bar password strength meter. */
export const StrengthMeter = memo(function StrengthMeter({ password }: { password: string }) {
    if (!password) return null;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const colors = ['#F2939A', '#F5C26B', '#8FD6A8', C.ok];
    const labels = ['Weak', 'Okay', 'Good', 'Strong'];
    const idx = Math.max(0, score - 1);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -4, paddingHorizontal: 2 }}>
            <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: i < score ? colors[idx] : 'rgba(255,255,255,0.09)',
                        }}
                    />
                ))}
            </View>
            <Text style={{ color: score ? colors[idx] : C.dim, fontSize: 11.5, fontWeight: '600', marginLeft: 10, width: 46 }}>
                {score ? labels[idx] : 'Too short'}
            </Text>
        </View>
    );
});

/* ------------------------------ styles -------------------------------- */

const styles = StyleSheet.create({
    halo: { position: 'absolute', backgroundColor: C.accent },
    card: {
        borderRadius: 28,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.card,
        padding: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 18 },
        elevation: 12,
    },
    cardSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
    field: {
        minHeight: 56,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: C.field,
        justifyContent: 'center',
        shadowColor: C.accent,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
    },
    label: { position: 'absolute', top: 18, fontSize: 15, fontWeight: '500' },
    input: {
        minHeight: 56,
        paddingTop: 20,
        paddingBottom: 6,
        color: C.text,
        fontSize: 15.5,
        fontWeight: '500',
    },
    eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
    btnShadow: {
        borderRadius: 16,
        shadowColor: C.accent,
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
    googleBtn: {
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: 'rgba(255,255,255,0.04)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    googleText: { color: C.text, fontSize: 15, fontWeight: '600' },
    line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.14)' },
    dividerText: {
        color: C.dim,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginHorizontal: 12,
    },
    error: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(242,147,154,0.25)',
        backgroundColor: 'rgba(242,147,154,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    errorText: { flex: 1, color: C.danger, fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
