import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    SharedValue,
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    /** The pager's scroll offset. Negative = pulled down past the first flare. */
    offset: SharedValue<number>;
    busy: boolean;
    threshold: number; // px of pull that arms the refresh
    hold: number; // px the page rests at while loading
    top: number;
};

const buzz = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
};

export function FlarePullLoader({ offset, busy, threshold, hold, top }: Props) {
    const busySV = useSharedValue(busy);
    const spin = useSharedValue(0);
    const bump = useSharedValue(1);

    useEffect(() => {
        busySV.value = busy;
        if (busy) {
            spin.value = 300; // continue from where the pull left the dot
            spin.value = withRepeat(withTiming(660, { duration: 900, easing: Easing.linear }), -1);
        } else {
            cancelAnimation(spin);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy]);

    // 0..1: how far along the pull is (or 1 while loading)
    const progress = () => {
        'worklet';
        const pull = Math.max(0, -offset.value);
        return Math.min(1, pull / (busySV.value ? hold : threshold));
    };

    // armed: tick + pulse the moment the pull crosses the threshold
    useAnimatedReaction(
        () => !busySV.value && -offset.value >= threshold,
        (armed, prev) => {
            if (armed && !prev) {
                bump.value = withSequence(withTiming(1.2, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 220 }));
                runOnJS(buzz)();
            }
        },
    );

    const token = useAnimatedStyle(() => {
        const p = progress();
        return {
            opacity: interpolate(p, [0, 0.25, 1], [0, 0.65, 1], Extrapolation.CLAMP),
            transform: [{ translateY: (p - 1) * 26 }, { scale: (0.55 + 0.45 * p) * bump.value }],
        };
    });

    const orbit = useAnimatedStyle(() => ({
        transform: [{ rotate: `${busySV.value ? spin.value : progress() * 300}deg` }],
    }));

    const innerRing = useAnimatedStyle(() => ({
        opacity: interpolate(progress(), [0.4, 1], [0.3, 1], Extrapolation.CLAMP),
        transform: [{ rotate: `${-(busySV.value ? spin.value : progress() * 300) * 0.6}deg` }],
    }));

    return (
        <View pointerEvents="none" className="absolute inset-x-0 items-center" style={{ top }}>
            <Animated.View
                style={[{ shadowColor: '#fff', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }, token]}
                className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/60"
            >
                <View className="h-[30px] w-[30px] rounded-full border border-white/25" />

                {/* a smaller counter-rotating ring for depth */}
                <Animated.View style={innerRing} className="absolute inset-0 items-center justify-center">
                    <View className="h-[16px] w-[16px] items-center rounded-full border border-white/20">
                        <View className="-mt-[2px] h-1 w-1 rounded-full bg-white/60" />
                    </View>
                </Animated.View>

                {/* the orbiting dot */}
                <Animated.View style={orbit} className="absolute inset-0 items-center justify-center">
                    <View className="h-[30px] w-[30px] items-center">
                        <View className="-mt-[3px] h-1.5 w-1.5 rounded-full bg-neutral-200" />
                    </View>
                </Animated.View>
            </Animated.View>
        </View>
    );
}