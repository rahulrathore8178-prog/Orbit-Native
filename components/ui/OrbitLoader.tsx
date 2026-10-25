import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Easing,
    Modal,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

type Props = {
    visible?: boolean;
    label?: string;
    subtext?: string;
};

const GOLD = '#d6b88a';
const BG = '#050507';
const TRAIL = 10; // comet tail length (dots)

// r is relative to a 400-unit canvas; dir: 1 = clockwise, -1 = counter-clockwise
const ORBITS = [
    { r: 170, color: '#ffffff', duration: 16000, dir: 1, startDeg: 210 },
    { r: 125, color: GOLD, duration: 11000, dir: -1, startDeg: 40 },
    { r: 85, color: 'rgba(255,255,255,0.55)', duration: 8000, dir: 1, startDeg: 120 },
];

// round to an even integer so every ring/centre lands on a whole pixel
const even = (n: number) => 2 * Math.round(n / 2);

/** A circle positioned by its centre point (no flex centring needed). */
function Dot({
    cx,
    cy,
    d,
    color,
    opacity = 1,
}: {
    cx: number;
    cy: number;
    d: number;
    color: string;
    opacity?: number;
}) {
    return (
        <View
            style={{
                position: 'absolute',
                left: cx - d / 2,
                top: cy - d / 2,
                width: d,
                height: d,
                borderRadius: d / 2,
                backgroundColor: color,
                opacity,
            }}
        />
    );
}

function Orbit({
    size,
    diameter,
    head,
    color,
    duration,
    dir,
    startDeg,
    animate,
}: {
    size: number;
    diameter: number;
    head: number;
    color: string;
    duration: number;
    dir: number;
    startDeg: number;
    animate: boolean;
}) {
    const spin = useRef(new Animated.Value(0)).current;
    const R = diameter / 2;

    useEffect(() => {
        if (!animate) return;
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [animate, duration, spin]);

    const rotate = spin.interpolate({
        inputRange: [0, 1],
        outputRange: [`${startDeg}deg`, `${startDeg + dir * 360}deg`],
    });

    // comet tail: static positions inside the rotating container
    const trail = useMemo(() => {
        const stepDeg = 46 / TRAIL;
        return Array.from({ length: TRAIL }, (_, i) => {
            const k = i + 1;
            const theta = (-dir * k * stepDeg * Math.PI) / 180;
            return {
                key: k,
                d: head * (1 - (k / TRAIL) * 0.65),
                cx: R + R * Math.sin(theta),
                cy: R - R * Math.cos(theta),
                opacity: 0.5 * Math.pow(1 - k / TRAIL, 1.6),
            };
        });
    }, [R, dir, head]);

    const offset = (size - diameter) / 2;

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: offset,
                left: offset,
                width: diameter,
                height: diameter,
                transform: [{ rotate }],
            }}
        >
            {trail.map((t) => (
                <Dot key={t.key} cx={t.cx} cy={t.cy} d={t.d} color={color} opacity={t.opacity} />
            ))}
            {/* soft halo + head, centred on the ring's top edge */}
            <Dot cx={R} cy={0} d={head * 3.6} color={color} opacity={0.1} />
            <Dot cx={R} cy={0} d={head * 2.3} color={color} opacity={0.18} />
            <Dot cx={R} cy={0} d={head} color={color} />
        </Animated.View>
    );
}

export default function OrbitLoader({
    visible = true,
    label = 'ORBIT',
    subtext = 'LOADING YOUR FEED',
}: Props) {
    const { width, height } = useWindowDimensions();

    // Fit the artwork to BOTH dimensions so it works on small, tall, wide and landscape screens.
    // Height share is kept at 60% so the wordmark/progress/subtext always fit below the rings.
    const size = even(Math.max(Math.min(width * 0.82, height * 0.6, 420), 160));
    const scale = size / 400;
    const head = Math.max(5, Math.round(size * 0.018));

    // typography scales with the artwork (and ignores the user's system font size)
    const wordSize = Math.round(size * 0.065);
    const wordSpacing = Math.round(wordSize * 0.4);
    const subSize = Math.max(9, Math.round(size * 0.03));
    const subSpacing = subSize * 0.35;

    const trackW = even(size * 0.28);
    const sweepW = even(trackW * 0.42);

    const [mounted, setMounted] = useState(visible);
    const [animate, setAnimate] = useState(true);

    const fade = useRef(new Animated.Value(visible ? 0 : 1)).current;
    const breathe = useRef(new Animated.Value(0)).current;
    const sweep = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then((reduced) => setAnimate(!reduced));
    }, []);

    // fade in / out (content also drifts in scale for a cinematic dissolve)
    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(fade, {
                toValue: 1,
                duration: 600,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fade, {
                toValue: 0,
                duration: 650,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, fade]);

    // slow wordmark breathing + hairline progress sweep
    useEffect(() => {
        if (!animate || !mounted) return;
        const b = Animated.loop(
            Animated.sequence([
                Animated.timing(breathe, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(breathe, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        );
        const s = Animated.loop(
            Animated.timing(sweep, {
                toValue: 1,
                duration: 1600,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            })
        );
        b.start();
        s.start();
        return () => {
            b.stop();
            s.stop();
        };
    }, [animate, mounted, breathe, sweep]);

    if (!mounted) return null;

    const contentScale = fade.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] });
    const wordOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
    const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
    const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-sweepW, trackW] });

    const c = size / 2; // centre of the artwork box

    return (
        // Modal renders above everything (tab bar, FAB, headers) and spans the whole window,
        // so the loader no longer depends on the size of whatever parent it is mounted in.
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={() => { }}
        >
            <Animated.View
                style={{ flex: 1, opacity: fade }}
                accessibilityLabel="Loading"
                accessibilityRole="progressbar"
            >
                <View className="flex-1 items-center justify-center bg-[#050507]">
                    <Animated.View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: [{ scale: contentScale }],
                        }}
                    >
                        {/* artwork box: every child is positioned from the centre (c, c) */}
                        <View style={{ width: size, height: size }}>
                            {/* ambient glow: layered translucent discs */}
                            <Animated.View
                                style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: glowOpacity }}
                            >
                                {[0.62, 0.46, 0.3].map((f, i) => (
                                    <Dot key={f} cx={c} cy={c} d={even(size * f)} color={GOLD} opacity={0.018 + i * 0.012} />
                                ))}
                            </Animated.View>

                            {/* hairline rings */}
                            {ORBITS.map((o) => {
                                const d = even(o.r * scale * 2);
                                return (
                                    <View
                                        key={`ring-${o.r}`}
                                        style={{
                                            position: 'absolute',
                                            top: (size - d) / 2,
                                            left: (size - d) / 2,
                                            width: d,
                                            height: d,
                                            borderRadius: d / 2,
                                            borderWidth: StyleSheet.hairlineWidth,
                                            borderColor: 'rgba(255,255,255,0.09)',
                                        }}
                                    />
                                );
                            })}

                            {/* orbiting points with comet trails */}
                            {ORBITS.map((o) => (
                                <Orbit
                                    key={`orbit-${o.r}`}
                                    size={size}
                                    diameter={even(o.r * scale * 2)}
                                    head={head}
                                    color={o.color}
                                    duration={o.duration}
                                    dir={o.dir}
                                    startDeg={o.startDeg}
                                    animate={animate}
                                />
                            ))}

                            {/* wordmark: explicit box, so it always sits dead-centre in the rings */}
                            <View
                                className="absolute items-center justify-center"
                                style={{ left: 0, top: 0, width: size, height: size }}
                            >
                                <Animated.Text
                                    allowFontScaling={false}
                                    includeFontPadding={false}
                                    style={{
                                        opacity: wordOpacity,
                                        color: '#fff',
                                        fontSize: wordSize,
                                        fontWeight: '200',
                                        letterSpacing: wordSpacing,
                                        marginLeft: wordSpacing, // offsets trailing letter-spacing so it looks truly centred
                                    }}
                                >
                                    {label}
                                </Animated.Text>
                            </View>
                        </View>

                        {/* hairline progress */}
                        <View
                            className="h-px overflow-hidden bg-white/10"
                            style={{ width: trackW, marginTop: Math.round(size * 0.08) }}
                        >
                            <Animated.View
                                style={{
                                    width: sweepW,
                                    height: 1,
                                    backgroundColor: GOLD,
                                    transform: [{ translateX: sweepX }],
                                }}
                            />
                        </View>

                        <Text
                            allowFontScaling={false}
                            className="text-white/40 font-medium"
                            style={{
                                marginTop: Math.round(size * 0.045),
                                fontSize: subSize,
                                letterSpacing: subSpacing,
                                paddingLeft: subSpacing, // balance trailing letter-spacing
                            }}
                        >
                            {subtext}
                        </Text>
                    </Animated.View>
                </View>
            </Animated.View>
        </Modal>
    );
}