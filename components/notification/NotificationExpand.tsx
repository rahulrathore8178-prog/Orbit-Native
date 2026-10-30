import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    Easing, interpolate, interpolateColor, runOnJS,
    useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

export type Rect = { x: number; y: number; w: number; h: number };

let runner: ((rect: Rect, action: () => void) => void) | null = null;

/** Expands from `rect` to full screen, runs `action` (the navigation) once covered, then fades away. */
export function expandThen(rect: Rect, action: () => void) {
    if (runner) runner(rect, action);
    else action();
}

const EXPAND = Easing.bezier(0.22, 1, 0.36, 1);

export function NotificationExpandHost() {
    const { width, height } = useWindowDimensions();
    const [visible, setVisible] = useState(false);
    const busy = useRef(false);
    const pending = useRef<() => void>(() => { });

    const p = useSharedValue(0);
    const fade = useSharedValue(1);
    const rx = useSharedValue(0);
    const ry = useSharedValue(0);
    const rw = useSharedValue(0);
    const rh = useSharedValue(0);

    const done = useCallback(() => {
        setVisible(false);
        busy.current = false;
    }, []);

    const finishCover = useCallback(() => {
        try { pending.current(); } catch { /* navigation failed: still fade out */ }
        // let the destination mount and paint under the cover, then reveal it
        setTimeout(() => {
            fade.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }, (f) => {
                if (f) runOnJS(done)();
            });
        }, 380);
    }, [fade, done]);

    const run = useCallback((rect: Rect, action: () => void) => {
        if (busy.current) return;
        busy.current = true;
        pending.current = action;
        rx.value = rect.x; ry.value = rect.y; rw.value = rect.w; rh.value = rect.h;
        p.value = 0;
        fade.value = 1;
        setVisible(true);
        p.value = withTiming(1, { duration: 340, easing: EXPAND }, (f) => {
            if (f) runOnJS(finishCover)();
        });
    }, [p, fade, rx, ry, rw, rh, finishCover]);

    useEffect(() => {
        runner = run;
        return () => { if (runner === run) runner = null; };
    }, [run]);

    const style = useAnimatedStyle(() => ({
        opacity: fade.value,
        left: interpolate(p.value, [0, 1], [rx.value, 0]),
        top: interpolate(p.value, [0, 1], [ry.value, 0]),
        width: interpolate(p.value, [0, 1], [rw.value, width]),
        height: interpolate(p.value, [0, 1], [rh.value, height + 80]), // + buffer for translucent nav bars
        borderRadius: interpolate(p.value, [0, 1], [16, 0]),
        borderColor: interpolateColor(p.value, [0, 1], ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']),
        backgroundColor: interpolateColor(
            p.value, [0, 0.5, 1],
            ['rgba(7,7,10,0)', 'rgba(7,7,10,0.85)', 'rgba(7,7,10,1)'],
        ),
    }));

    if (!visible) return null;
    return <Animated.View pointerEvents="auto" style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
    card: { position: 'absolute', borderWidth: 1, overflow: 'hidden', zIndex: 9999, elevation: 9999 },
});