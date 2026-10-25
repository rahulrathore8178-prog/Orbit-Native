import { BlurView } from "expo-blur";
import React, { ReactNode, useEffect } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
    Easing,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import { EASE_OUT, W } from "./utils";

/* ---------------- Glass ---------------- */
export function Glass({ children, style, className = "", intensity = 40 }:
    { children?: ReactNode; style?: StyleProp<ViewStyle>; className?: string; intensity?: number }) {
    return (
        <View className={`overflow-hidden border border-white/10 bg-white/[0.045] ${className}`} style={style}>
            <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" className="absolute inset-0 rounded-full border-t border-white/[0.06]" />
            {children}
        </View>
    );
}

/* ---------------- NeoButton ----------------
   Neumorphic button: raised at rest, sinks in while pressed. */
export function NeoButton({ onPress, disabled, label, size = 36, round = true, active = false, children, style }: {
    onPress?: () => void; disabled?: boolean; label: string; size?: number; round?: boolean;
    active?: boolean; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.92]) }],
        backgroundColor: interpolateColor(p.value, [0, 1], [active ? "#f4f4f5" : "#18181c", active ? "#d4d4d8" : "#0b0b0d"]),
        shadowOpacity: interpolate(p.value, [0, 1], [0.85, 0.15]),
        shadowRadius: interpolate(p.value, [0, 1], [9, 2]),
        borderTopColor: interpolateColor(p.value, [0, 1], [W(0.14), "rgba(0,0,0,0.5)"]),
        borderLeftColor: interpolateColor(p.value, [0, 1], [W(0.1), "rgba(0,0,0,0.5)"]),
        borderBottomColor: interpolateColor(p.value, [0, 1], ["rgba(0,0,0,0.7)", W(0.06)]),
        borderRightColor: interpolateColor(p.value, [0, 1], ["rgba(0,0,0,0.6)", W(0.04)]),
    }));

    return (
        <Pressable
            accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6}
            className={disabled ? "opacity-40" : "opacity-100"}
            onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
            onPressOut={() => { p.value = withTiming(0, { duration: 260, easing: EASE_OUT }); }}>
            <Animated.View
                className="border items-center justify-center"
                style={[{ width: size, height: size, borderRadius: round ? size / 2 : 14, shadowColor: "#000", shadowOffset: { width: 4, height: 5 }, elevation: 6 }, a, style]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

/* ---------------- NeoWide (full-width neo button) ---------------- */
export function NeoWide({ label, onPress }: { label: string; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.97]) }],
        backgroundColor: interpolateColor(p.value, [0, 1], ["#18181c", "#0b0b0d"]),
        shadowOpacity: interpolate(p.value, [0, 1], [0.8, 0.15]),
    }));
    return (
        <Pressable
            accessibilityRole="button" onPress={onPress}
            onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
            onPressOut={() => { p.value = withTiming(0, { duration: 260, easing: EASE_OUT }); }}>
            <Animated.View
                className="rounded-2xl border border-white/[0.08] border-t-white/[0.14] py-2.5 items-center"
                style={[{ shadowColor: "#000", shadowOffset: { width: 3, height: 4 }, shadowRadius: 8, elevation: 5 }, a]}>
                <Text className="text-sm text-zinc-200">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

/* ---------------- Reveal (one-shot mount animation, UI thread) ---------------- */
export function Reveal({ children, delay = 0, duration = 600, y = 0, scale = 1, easing = Easing.out(Easing.cubic), className, style }: {
    children: ReactNode; delay?: number; duration?: number; y?: number; scale?: number;
    easing?: (t: number) => number; className?: string; style?: StyleProp<ViewStyle>;
}) {
    const reduce = useReducedMotion();
    const p = useSharedValue(reduce ? 1 : 0);
    useEffect(() => {
        if (!reduce) p.value = withDelay(delay, withTiming(1, { duration, easing }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const a = useAnimatedStyle(() => ({
        opacity: p.value,
        transform: [{ translateY: (1 - p.value) * y }, { scale: scale + (1 - scale) * p.value }],
    }));
    return <Animated.View className={className} style={[style, a]}>{children}</Animated.View>;
}
