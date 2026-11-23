import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

/* ---- feel: tweak these ---- */
const OPEN_SPRING = { damping: 24, stiffness: 260, mass: 0.9 }; // lively, a hair of settle
const CLOSE_MS = 210; // closing is a touch faster than opening
const RISE = 0.14; // how far below its final spot the page starts (fraction of screen height)
const START_SCALE = 0.92;
const START_RADIUS = 36;

type Props = {
    /** Receives `close`: call it for the back button. It plays the closing animation, then leaves the route. */
    children: (close: () => void) => React.ReactNode;
};

export function FlareTransition({ children }: Props) {
    const router = useRouter();
    const { height } = useWindowDimensions();
    const p = useSharedValue(0); // 0 = hidden below Home, 1 = fully open
    const closing = useRef(false);

    useEffect(() => {
        p.value = withSpring(1, OPEN_SPRING);
    }, [p]);

    const leave = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
    }, [router]);

    const close = useCallback(() => {
        if (closing.current) return;
        closing.current = true;
        p.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
            if (finished) runOnJS(leave)();
        });
    }, [p, leave]);

    // Android back button / gesture plays the closing animation too (only while this screen is on top)
    useFocusEffect(
        useCallback(() => {
            const sub = BackHandler.addEventListener('hardwareBackPress', () => {
                close();
                return true;
            });
            return () => sub.remove();
        }, [close]),
    );

    // Home stays visible underneath and dims as the page rises
    const backdrop = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0, 1], [0, 0.85], Extrapolation.CLAMP),
    }));

    const sheet = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0, 0.55], [0, 1], Extrapolation.CLAMP),
        borderRadius: interpolate(p.value, [0, 1], [START_RADIUS, 0], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(p.value, [0, 1], [height * RISE, 0]) },
            { scale: interpolate(p.value, [0, 1], [START_SCALE, 1]) },
        ],
    }));

    return (
        <Animated.View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' }, backdrop]} />
            <Animated.View style={[{ flex: 1, overflow: 'hidden', backgroundColor: '#000' }, sheet]}>
                {children(close)}
            </Animated.View>
        </Animated.View>
    );
}