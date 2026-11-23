import { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';

export type Zone = 0 | 1 | 2; // 0 = left, 1 = center, 2 = right

/* ---- tweak these ---- */
export const SIDE = 0.2; // each side zone = 20% of the width
const HOLD_MS = 260; // how long you hold before speed / scrub kicks in
const SCRUB_SPAN = 90; // a full-width drag scrubs at most this many seconds
const EMIT_MS = 60; // how often the live scrub seeks the player

type Props = {
    width: number;
    progress: SharedValue<number>;
    duration: SharedValue<number>;
    scrubbing: SharedValue<number>;
    hold: SharedValue<number>;
    onTap: (zone: Zone) => void;
    onDoubleTap: (zone: Zone, x: number, y: number) => void;
    onSpeed: (on: boolean) => void;
    onScrubStart: () => void;
    onScrubMove: (seconds: number) => void;
    onScrubEnd: (seconds: number) => void;
};

const zoneOf = (x: number, w: number): Zone => {
    'worklet';
    const r = w > 0 ? x / w : 0.5;
    return r < SIDE ? 0 : r > 1 - SIDE ? 2 : 1;
};

export function FlareGestures(props: Props) {
    const { width, progress, duration, scrubbing, hold } = props;

    // always call the latest handlers without rebuilding the gesture
    const cb = useRef(props);
    cb.current = props;
    const jsTap = useCallback((z: number) => cb.current.onTap(z as Zone), []);
    const jsDouble = useCallback((z: number, x: number, y: number) => cb.current.onDoubleTap(z as Zone, x, y), []);
    const jsSpeed = useCallback((on: boolean) => cb.current.onSpeed(on), []);
    const jsScrubStart = useCallback(() => cb.current.onScrubStart(), []);
    const jsScrubMove = useCallback((t: number) => cb.current.onScrubMove(t), []);
    const jsScrubEnd = useCallback((t: number) => cb.current.onScrubEnd(t), []);

    const mode = useSharedValue(0); // 0 idle, 1 speed, 2 scrub
    const startP = useSharedValue(0);
    const lastEmit = useSharedValue(0);

    const gesture = useMemo(() => {
        const single = Gesture.Tap()
            .numberOfTaps(1)
            .maxDuration(250)
            .onEnd((e, ok) => {
                'worklet';
                if (ok) runOnJS(jsTap)(zoneOf(e.x, width));
            });

        const double = Gesture.Tap()
            .numberOfTaps(2)
            .maxDelay(220)
            .onEnd((e, ok) => {
                'worklet';
                if (ok) runOnJS(jsDouble)(zoneOf(e.x, width), e.x, e.y);
            });

        // hold (sides: 2x speed, center: scrub by dragging anywhere)
        const holdPan = Gesture.Pan()
            .activateAfterLongPress(HOLD_MS)
            .onStart((e) => {
                'worklet';
                const z = zoneOf(e.x, width);
                hold.value = withTiming(1, { duration: 180 });
                if (z === 1) {
                    mode.value = 2;
                    startP.value = progress.value;
                    lastEmit.value = 0;
                    scrubbing.value = withTiming(1, { duration: 160 });
                    runOnJS(jsScrubStart)();
                } else {
                    mode.value = 1;
                    runOnJS(jsSpeed)(true);
                }
            })
            .onUpdate((e) => {
                'worklet';
                if (mode.value !== 2) return;
                const d = duration.value;
                if (d <= 0 || width <= 0) return;
                const span = Math.min(d, SCRUB_SPAN);
                const t = Math.min(Math.max(startP.value * d + (e.translationX / width) * span, 0), Math.max(0, d - 0.05));
                progress.value = t / d;
                const now = Date.now();
                if (now - lastEmit.value > EMIT_MS) {
                    lastEmit.value = now;
                    runOnJS(jsScrubMove)(t);
                }
            })
            .onFinalize(() => {
                'worklet';
                const m = mode.value;
                if (m === 0) return;
                mode.value = 0;
                hold.value = withTiming(0, { duration: 220 });
                if (m === 2) {
                    scrubbing.value = withTiming(0, { duration: 200 });
                    runOnJS(jsScrubEnd)(progress.value * duration.value);
                } else {
                    runOnJS(jsSpeed)(false);
                }
            });

        return Gesture.Race(holdPan, Gesture.Exclusive(double, single));
    }, [width, progress, duration, scrubbing, hold, mode, startP, lastEmit, jsTap, jsDouble, jsSpeed, jsScrubStart, jsScrubMove, jsScrubEnd]);

    return (
        <GestureDetector gesture={gesture}>
            <View className="absolute inset-0" collapsable={false} />
        </GestureDetector>
    );
}