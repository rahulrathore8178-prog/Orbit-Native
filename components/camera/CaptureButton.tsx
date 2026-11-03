import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing, interpolate, interpolateColor, useAnimatedProps, useAnimatedStyle,
    useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

export const MAX_VIDEO_SECONDS = 60;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const BTN = 84, BOX = 136, R = 41, CIRC = 2 * Math.PI * R, C = (BTN + 8) / 2;

/* ---- zoom feel: tweak these ---- */
/** Finger travel (px) before zoom starts, so a tiny wobble while holding doesn't zoom. */
const ZOOM_DEAD_ZONE = 10;
/** How much of the finger travel is passed on. Lower = slower / less aggressive zoom. */
const ZOOM_GAIN = 0.45;
/** 0..1 per tick. Lower = smoother/laggier glide, higher = snappier. */
const ZOOM_SMOOTHING = 0.22;
/** How often (ms) zoom updates are sent to the parent. ~30fps keeps the camera from being flooded. */
const ZOOM_TICK_MS = 32;

type Props = {
    recording: boolean;
    disabled?: boolean;
    onTap: () => void;
    onHoldStart: () => void;
    onHoldEnd: () => void;
    onZoomDrag: (dy: number) => void; // finger travel since hold began (negative = up)
};

const Dot = ({ top, color, size = 6 }: { top?: boolean; color: string; size?: number }) => (
    <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        left: '50%', marginLeft: -size / 2, ...(top ? { top: -size / 2 } : { bottom: -size / 2 }),
        shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    }} />
);

/** dead zone + linear gain, keeps the sign (negative = finger moved up) */
const shapeDrag = (dy: number) => {
    const m = Math.max(0, Math.abs(dy) - ZOOM_DEAD_ZONE) * ZOOM_GAIN;
    return dy < 0 ? -m : m;
};

export const CaptureButton = memo(function CaptureButton({
    recording, disabled, onTap, onHoldStart, onHoldEnd, onZoomDrag,
}: Props) {
    const rot = useSharedValue(0);
    const rec = useSharedValue(0);
    const press = useSharedValue(1);
    const prog = useSharedValue(0);
    const holding = useRef(false);

    // zoom smoothing state
    const target = useRef(0);
    const current = useRef(0);
    const lastSent = useRef(0);
    const lastTick = useRef(0);
    const raf = useRef<number | null>(null);

    useEffect(() => {
        rot.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false);
    }, [rot]);

    useEffect(() => {
        rec.value = withSpring(recording ? 1 : 0, { damping: 14, stiffness: 170 });
        if (recording) {
            prog.value = 0;
            prog.value = withTiming(1, { duration: MAX_VIDEO_SECONDS * 1000, easing: Easing.linear });
        } else prog.value = withTiming(0, { duration: 150 });
    }, [recording, rec, prog]);

    const h = useRef({ disabled, onTap, onHoldStart, onHoldEnd, onZoomDrag });
    h.current = { disabled, onTap, onHoldStart, onHoldEnd, onZoomDrag };

    const stopZoomLoop = useCallback(() => {
        if (raf.current != null) cancelAnimationFrame(raf.current);
        raf.current = null;
    }, []);

    const startZoomLoop = useCallback(() => {
        stopZoomLoop();
        target.current = 0; current.current = 0; lastSent.current = 0; lastTick.current = 0;
        const step = (t: number) => {
            if (!holding.current) { raf.current = null; return; }
            if (t - lastTick.current >= ZOOM_TICK_MS) {
                lastTick.current = t;
                current.current += (target.current - current.current) * ZOOM_SMOOTHING;
                if (Math.abs(target.current - current.current) < 0.05) current.current = target.current;
                if (Math.abs(current.current - lastSent.current) >= 0.25) {
                    lastSent.current = current.current;
                    h.current.onZoomDrag(current.current);
                }
            }
            raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
    }, [stopZoomLoop]);

    useEffect(() => () => stopZoomLoop(), [stopZoomLoop]);

    const gesture = useMemo(() => {
        const down = () => { press.value = withSpring(0.88, { damping: 16, stiffness: 300 }); };
        const up = () => { press.value = withSpring(1, { damping: 14, stiffness: 220 }); };

        const tap = Gesture.Tap().maxDuration(220).runOnJS(true)
            .onBegin(down)
            .onEnd((_e, ok) => { if (ok && !h.current.disabled) h.current.onTap(); })
            .onFinalize(up);

        const hold = Gesture.Pan().activateAfterLongPress(220).runOnJS(true)
            .onBegin(down)
            .onStart(() => {
                if (h.current.disabled) return;
                holding.current = true;
                startZoomLoop();
                h.current.onHoldStart();
            })
            .onUpdate((e) => { if (holding.current) target.current = shapeDrag(e.translationY); })
            // finger lifted (or the touch was cancelled) -> stop recording immediately
            .onFinalize(() => {
                up();
                if (!holding.current) return;
                holding.current = false;
                stopZoomLoop();
                h.current.onHoldEnd();
            });

        return Gesture.Race(hold, tap);
    }, [press, startZoomLoop, stopZoomLoop]);

    const ringA = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }], opacity: 1 - rec.value * 0.75 }));
    const ringB = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rot.value * 1.7}deg` }], opacity: 1 - rec.value * 0.75 }));
    const outer = useAnimatedStyle(() => ({ transform: [{ scale: press.value * interpolate(rec.value, [0, 1], [1, 1.08]) }] }));
    const inner = useAnimatedStyle(() => {
        const s = interpolate(rec.value, [0, 1], [66, 30]);
        return {
            width: s, height: s, borderRadius: interpolate(rec.value, [0, 1], [33, 8]),
            backgroundColor: interpolateColor(rec.value, [0, 1], ['#FFFFFF', '#FF3B4E']),
            transform: [{ scale: press.value }],
        };
    });
    const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - prog.value) }));
    const trackStyle = useAnimatedStyle(() => ({ opacity: rec.value }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={styles.box} collapsable={false}>
                <Animated.View style={[styles.orbit, { width: 118, height: 118, borderRadius: 59 }, ringA]}>
                    <Dot top color="#A99BFF" size={7} />
                    <Dot color="#5EE6D0" size={5} />
                </Animated.View>
                <Animated.View style={[styles.orbit, { width: 102, height: 102, borderRadius: 51 }, ringB]}>
                    <Dot top color="#FFFFFF" size={5} />
                    <Dot color="#FF8FB1" size={4} />
                </Animated.View>

                <Animated.View style={[StyleSheet.absoluteFill, styles.center, trackStyle]} pointerEvents="none">
                    <Svg width={BTN + 8} height={BTN + 8}>
                        <Circle cx={C} cy={C} r={R} stroke="rgba(255,255,255,0.25)" strokeWidth={4} fill="none" />
                        <AnimatedCircle
                            cx={C} cy={C} r={R} stroke="#FF3B4E" strokeWidth={4} fill="none" strokeLinecap="round"
                            strokeDasharray={CIRC} animatedProps={arc} rotation={-90} origin={`${C}, ${C}`}
                        />
                    </Svg>
                </Animated.View>

                <Animated.View style={[styles.ring, outer]} />
                <Animated.View style={inner} />
            </Animated.View>
        </GestureDetector>
    );
});

const styles = StyleSheet.create({
    box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center', justifyContent: 'center' },
    orbit: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.18)' },
    ring: { position: 'absolute', width: BTN, height: BTN, borderRadius: BTN / 2, borderWidth: 3.5, borderColor: '#fff' },
});