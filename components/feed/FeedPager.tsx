import { ReactNode } from 'react';
import { GestureResponderHandlers, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type Props = {
    position: SharedValue<number>;
    panHandlers: GestureResponderHandlers;
    children: [ReactNode, ReactNode];
};

// Reanimated components don't pick up NativeWind `className` in this project, so layout is a real style.
const styles = StyleSheet.create({
    pager: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
});

/**
 * Two full-screen pages side by side. Sliding is a single translateX driven by `position`
 * on the UI thread, so the pages follow the finger and settle without touching React.
 * Put the swipe handlers here (not on the screen root) so the capsule tray, which scrolls
 * sideways itself, never competes with the tab swipe.
 */
export function FeedPager({ position, panHandlers, children }: Props) {
    const { width } = useWindowDimensions();
    const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -position.get() * width }] }));

    return (
        <Animated.View {...panHandlers} style={[styles.pager, { width: width * 2 }, slide]}>
            <View style={{ width }}>{children[0]}</View>
            <View style={{ width }}>{children[1]}</View>
        </Animated.View>
    );
}