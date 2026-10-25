import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const DISTANCE = 36; // max horizontal drift (px) used for the slide + fade
const THRESHOLD = 60; // drag distance that commits a tab change
const VELOCITY = 500; // or a quick flick faster than this (px/s)

type Props<T extends string> = {
    keys: readonly T[];
    active: T;
    onChange: (tab: T) => void;
    children: React.ReactNode;
    /** layout classes for the wrapper, e.g. "flex-1" in a fixed-height screen or "min-h-[320px]" inside a ScrollView */
    className?: string;
};

/**
 * Wrap the tab's content. Swipe left/right to change tab.
 * While dragging, the content follows the finger a little and fades slightly;
 * after the change the new content eases in from the swipe direction.
 * Tapping a tab in <ProfileTabs /> triggers the same enter animation.
 */
export default function SwipeTabContent<T extends string>({ keys, active, onChange, children, className }: Props<T>) {
    const x = useSharedValue(0);
    const index = keys.indexOf(active);
    const last = keys.length - 1;
    const prev = useRef(index);

    // The gesture worklets read the CURRENT tab from a shared value instead of a captured
    // React variable, so they never go stale (stale = "can only swipe from the first tab").
    const indexSV = useSharedValue(index);

    // always call the latest props from a stable callback
    const latest = useRef({ keys, onChange });
    latest.current = { keys, onChange };
    const goTo = useCallback((i: number) => {
        latest.current.onChange(latest.current.keys[i]);
    }, []);

    // keep the shared index in sync + play the enter animation (swipe OR tab press)
    useEffect(() => {
        indexSV.value = index;
        if (prev.current === index) return;
        const dir = index > prev.current ? 1 : -1;
        prev.current = index;
        x.value = dir * DISTANCE;
        x.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    }, [index, indexSV, x]);

    const pan = useMemo(
        () =>
            Gesture.Pan()
                // only claim clearly horizontal drags so vertical scrolling keeps working
                .activeOffsetX([-16, 16])
                .failOffsetY([-14, 14])
                .onUpdate((e) => {
                    const next = indexSV.value + (e.translationX < 0 ? 1 : -1);
                    const allowed = next >= 0 && next <= last;
                    x.value = e.translationX * (allowed ? 0.3 : 0.08); // rubber-band at the ends
                })
                .onEnd((e) => {
                    const dir = e.translationX < 0 ? 1 : -1; // +1 = next tab, -1 = previous tab
                    const next = indexSV.value + dir;
                    const commit =
                        Math.abs(e.translationX) > THRESHOLD ||
                        (Math.abs(e.velocityX) > VELOCITY && e.velocityX * e.translationX > 0);

                    if (commit && next >= 0 && next <= last) {
                        x.value = withTiming(
                            -dir * DISTANCE,
                            { duration: 100, easing: Easing.in(Easing.quad) },
                            (finished) => {
                                if (finished) runOnJS(goTo)(next);
                            }
                        );
                    } else {
                        x.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
                    }
                }),
        [indexSV, last, x, goTo]
    );

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(Math.abs(x.value), [0, DISTANCE], [1, 0.45], 'clamp'),
        transform: [{ translateX: x.value }],
    }));

    return (
        <GestureDetector gesture={pan}>
            {/* collapsable={false} keeps the native view alive so the gesture always attaches */}
            <View className={className} collapsable={false}>
                <Animated.View style={animatedStyle}>{children}</Animated.View>
            </View>
        </GestureDetector>
    );
}