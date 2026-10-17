import { ReactNode, useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";

type Props = {
    children: ReactNode;
    className?: string;
    style?: StyleProp<ViewStyle>;
    delay?: number;
    duration?: number;
    /** start offset in px (translateY) */
    y?: number;
    /** start scale */
    scale?: number;
    easing?: (t: number) => number;
};

/** Mount animation that runs entirely on the UI thread (fade + slide + scale). */
export function Reveal({
    children,
    className,
    style,
    delay = 0,
    duration = 600,
    y = 0,
    scale = 1,
    easing = Easing.out(Easing.cubic),
}: Props) {
    const reduceMotion = useReducedMotion();
    const progress = useSharedValue(reduceMotion ? 1 : 0);

    useEffect(() => {
        if (!reduceMotion) progress.value = withDelay(delay, withTiming(1, { duration, easing }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, progress.value * 1.4),
        transform: [
            { translateY: (1 - progress.value) * y },
            { scale: scale + (1 - scale) * progress.value },
        ],
    }));

    return (
        <Animated.View className={className} style={[style, animatedStyle]}>
            {children}
        </Animated.View>
    );
}