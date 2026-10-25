import { Reveal } from "./Reaveal";
// import { white } from "@/components/ui/ActionSheet";
import { white } from "@/components/ui/search/theme"
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RING_SIZES = [52, 84, 122]; // % of the shorter screen side

function Ring({ diameter, index }: { diameter: number; index: number }) {
    const reduceMotion = useReducedMotion();
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion) return;
        rotation.value = withRepeat(
            withTiming(360, { duration: (28 + index * 14) * 1000, easing: Easing.linear }),
            -1,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
    const dot = index === 1 ? "h-2 w-2 -mt-1" : "h-1.5 w-1.5 -mt-[3px]";

    return (
        <Reveal
            delay={index * 180}
            duration={1600}
            scale={0.55}
            easing={Easing.out(Easing.exp)}
            className="absolute inset-0 items-center justify-center"
        >
            {/* diameter depends on the screen size, so this one needs a style */}
            <View className="rounded-full border border-white/[0.11]" style={{ width: diameter, height: diameter }}>
                <Animated.View style={spin} className="absolute inset-0 items-center">
                    <View className={`rounded-full bg-neutral-300 ${dot}`} />
                </Animated.View>
            </View>
        </Reveal>
    );
}

export function OrbitBackdrop() {
    const { width, height } = useWindowDimensions();
    const vmin = Math.min(width, height) / 100;

    return (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center opacity-30">
            <Reveal delay={0} duration={1400} className="absolute inset-0">
                <LinearGradient
                    colors={[white(0.09), "transparent"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.6 }}
                    style={StyleSheet.absoluteFill}
                />
            </Reveal>
            {RING_SIZES.map((size, i) => (
                <Ring key={size} diameter={size * vmin} index={i} />
            ))}
        </View>
    );
}