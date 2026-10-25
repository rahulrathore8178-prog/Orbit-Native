import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { cssInterop } from 'nativewind';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GRID, tileSize } from './SavedPostTile';

cssInterop(BlurView, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

export const HEADER_H = 56;

/* ───────────── Soft violet glow behind everything ───────────── */
export const AmbientBackground = () => (
    <View pointerEvents="none" className="absolute inset-0 bg-[#07070A]">
        <LinearGradient
            colors={['rgba(124,108,255,0.16)', 'rgba(124,108,255,0)']}
            className="absolute inset-x-0 top-0 h-[380px]"
        />
    </View>
);

/* ───────────── Glass header: blur fades in as you scroll ───────────── */
export function GlassHeader({
    title,
    scrollY,
    right,
    alwaysVisible,
}: {
    title: string;
    scrollY?: SharedValue<number>;
    right?: ReactNode;
    alwaysVisible?: boolean;
}) {
    const insets = useSafeAreaInsets();

    const glass = useAnimatedStyle(() => ({
        opacity: alwaysVisible
            ? 1
            : interpolate(scrollY?.value ?? 0, [0, 70], [0, 1], Extrapolation.CLAMP),
    }));
    const titleStyle = useAnimatedStyle(() => ({
        opacity: alwaysVisible
            ? 1
            : interpolate(scrollY?.value ?? 0, [50, 100], [0, 1], Extrapolation.CLAMP),
    }));

    return (
        <View
            className="absolute inset-x-0 top-0 z-10"
            style={{ height: insets.top + HEADER_H, paddingTop: insets.top }}
        >
            <Animated.View style={glass} className="absolute inset-0 border-b border-white/[0.06]">
                <BlurView intensity={45} tint="dark" className="absolute inset-0" />
                <View className="absolute inset-0 bg-[#07070A]/60" />
            </Animated.View>

            <View className="h-14 flex-row items-center justify-between px-4">
                <Pressable
                    hitSlop={8}
                    onPress={() => {
                        Haptics.selectionAsync();
                        router.back();
                    }}
                    className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:bg-white/10"
                >
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                </Pressable>

                <Animated.Text style={titleStyle} className="text-[16px] font-semibold text-white">
                    {title}
                </Animated.Text>

                <View className="h-10 w-10 items-center justify-center">{right}</View>
            </View>
        </View>
    );
}

/* ───────────── Loading skeleton (single shared pulse) ───────────── */
export function GridSkeleton() {
    const { width } = useWindowDimensions();
    const { w, h } = tileSize(width);
    const pulse = useSharedValue(0.45);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, [pulse]);
    const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <View className="flex-row flex-wrap gap-3" style={{ paddingHorizontal: GRID.PAD }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <Animated.View
                    key={i}
                    style={[{ width: w, height: h }, style]}
                    className="rounded-[26px] border border-white/[0.06] bg-white/[0.04]"
                />
            ))}
        </View>
    );
}

/* ───────────── Empty / error state ───────────── */
export function StateView({
    icon,
    title,
    message,
    action,
    onAction,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    action?: string;
    onAction?: () => void;
}) {
    return (
        <View className="items-center px-10 pt-24">
            <View className="h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-2xl shadow-black">
                <Ionicons name={icon} size={30} color="rgba(255,255,255,0.85)" />
            </View>
            <Text className="mt-6 text-[20px] font-semibold tracking-tight text-white">{title}</Text>
            <Text className="mt-2 text-center text-[14px] leading-[21px] text-white/50">{message}</Text>
            {action && (
                <Pressable
                    onPress={onAction}
                    className="mt-7 rounded-full border border-white/15 bg-white/[0.08] px-6 py-3 active:bg-white/15"
                >
                    <Text className="text-[14px] font-semibold text-white">{action}</Text>
                </Pressable>
            )}
        </View>
    );
}
