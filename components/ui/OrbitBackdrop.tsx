import { memo, useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

cssInterop(LinearGradient, { className: 'style' });

type Props = {
    /** Master switch. false renders nothing. */
    enabled?: boolean;
    /** false = static rings (no spinning dots). Also used automatically when the OS asks for reduced motion. */
    animated?: boolean;
    /** Overall strength, 0 to 1. */
    opacity?: number;
    /** Ring diameters in vmin (percent of the shorter screen side). */
    sizes?: number[];
};

const DEFAULT_SIZES = [52, 84, 122];

function Ring({ diameter, index, animated }: { diameter: number; index: number; animated: boolean }) {
    const enter = useSharedValue(animated ? 0 : 1);
    const spin = useSharedValue(0);

    // entrance: rings grow in one after another
    useEffect(() => {
        if (!animated) return;
        enter.value = withDelay(index * 180, withTiming(1, { duration: 1600, easing: Easing.out(Easing.exp) }));
    }, [animated, index, enter]);

    // orbit: outer rings turn slower
    useEffect(() => {
        if (!animated) {
            cancelAnimation(spin);
            return;
        }
        spin.value = 0;
        spin.value = withRepeat(
            withTiming(360, { duration: 28000 + index * 14000, easing: Easing.linear }),
            -1,
            false,
        );
        return () => cancelAnimation(spin);
    }, [animated, index, spin]);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: enter.value,
        transform: [{ scale: interpolate(enter.value, [0, 1], [0.55, 1]) }],
    }));
    const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

    const dot = index === 1 ? 8 : 6;

    return (
        <View className="absolute inset-0 items-center justify-center">
            <Animated.View
                className="rounded-full border border-white/[0.11]"
                style={[{ width: diameter, height: diameter }, ringStyle]}
            >
                <Animated.View className="absolute inset-0" style={orbitStyle}>
                    <View
                        className="absolute rounded-full bg-neutral-300"
                        style={{
                            width: dot,
                            height: dot,
                            left: diameter / 2 - dot / 2,
                            top: -dot / 2,
                            shadowColor: '#fff',
                            shadowOpacity: 0.35,
                            shadowRadius: 7,
                            shadowOffset: { width: 0, height: 0 },
                        }}
                    />
                </Animated.View>
            </Animated.View>
        </View>
    );
}

/**
 * Orbit rings with slowly circling dots. Drop it as the first child of any screen:
 *   <OrbitBackdrop />                       default
 *   <OrbitBackdrop opacity={0.2} />         subtler
 *   <OrbitBackdrop animated={false} />      static
 *   <OrbitBackdrop enabled={false} />       off
 */
function OrbitBackdrop({ enabled = true, animated = true, opacity = 0.3, sizes = DEFAULT_SIZES }: Props) {
    const { width, height } = useWindowDimensions();
    const reduced = useReducedMotion();
    if (!enabled) return null;

    const vmin = Math.min(width, height) / 100;
    const run = animated && !reduced;

    return (
        <View pointerEvents="none" className="absolute inset-0 overflow-hidden" style={{ opacity }}>
            <LinearGradient
                colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                className="absolute inset-x-0 top-0 h-[60%]"
            />
            {sizes.map((s, i) => (
                <Ring key={s} diameter={s * vmin} index={i} animated={run} />
            ))}
        </View>
    );
}

export default memo(OrbitBackdrop);
