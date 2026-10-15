import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Easing,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';

type Props = {
    visible?: boolean;
    label?: string;
    subtext?: string;
};

const GOLD = '#d6b88a';
const TRAIL = 10; // comet tail length (dots)

// radius is relative to a 400 unit canvas; dir: 1 = clockwise, -1 = counter-clockwise
const ORBITS = [
    { r: 170, color: '#ffffff', duration: 16000, dir: 1, startDeg: 210 },
    { r: 125, color: GOLD, duration: 11000, dir: -1, startDeg: 40 },
    { r: 85, color: 'rgba(255,255,255,0.55)', duration: 8000, dir: 1, startDeg: 120 },
];

function Orbit({
    size,
    diameter,
    color,
    duration,
    dir,
    startDeg,
    animate,
}: {
    size: number;
    diameter: number;
    color: string;
    duration: number;
    dir: number;
    startDeg: number;
    animate: boolean;
}) {
    const spin = useRef(new Animated.Value(0)).current;
    const R = diameter / 2;
    const HEAD = 6;

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

    // comet tail: static positions inside the rotating container (computed once)
    const trail = useMemo(() => {
        const stepDeg = 46 / TRAIL;
        return Array.from({ length: TRAIL }, (_, i) => {
            const k = i + 1;
            const theta = (-dir * k * stepDeg * Math.PI) / 180;
            const s = HEAD * (1 - (k / TRAIL) * 0.65);
            return {
                key: k,
                s,
                x: R + R * Math.sin(theta) - s / 2,
                y: R - R * Math.cos(theta) - s / 2,
                opacity: 0.5 * Math.pow(1 - k / TRAIL, 1.6),
            };
        });
    }, [R, dir]);

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
                <View
                    key={t.key}
                    style={{
                        position: 'absolute',
                        left: t.x,
                        top: t.y,
                        width: t.s,
                        height: t.s,
                        borderRadius: t.s / 2,
                        backgroundColor: color,
                        opacity: t.opacity,
                    }}
                />
            ))}
            {/* soft halo + head */}
            <View
                style={{
                    position: 'absolute',
                    left: R - 11,
                    top: -11,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: color,
                    opacity: 0.1,
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    left: R - 7,
                    top: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: color,
                    opacity: 0.18,
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    left: R - HEAD / 2,
                    top: -HEAD / 2,
                    width: HEAD,
                    height: HEAD,
                    borderRadius: HEAD / 2,
                    backgroundColor: color,
                }}
            />
        </Animated.View>
    );
}

export default function OrbitLoader({
    visible = true,
    label = 'ORBIT',
    subtext = 'LOADING YOUR FEED',
}: Props) {
    const { width } = useWindowDimensions();
    const size = Math.min(width * 0.82, 340);
    const scale = size / 400;

    const [mounted, setMounted] = useState(visible);
    const [animate, setAnimate] = useState(true);

    const fade = useRef(new Animated.Value(visible ? 0 : 1)).current;
    const breathe = useRef(new Animated.Value(0)).current;
    const sweep = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then((reduced) => setAnimate(!reduced));
    }, []);

    // fade in / out (the content also drifts in scale for a cinematic dissolve)
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
    const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-40, 110] });

    return (
        <Animated.View
            style={[styles.overlay, { opacity: fade }]}
            pointerEvents={visible ? 'auto' : 'none'}
            accessibilityLabel="Loading"
            accessibilityRole="progressbar"
        >
            <Animated.View style={[styles.content, { transform: [{ scale: contentScale }] }]}>
                <View style={{ width: size, height: size }}>
                    {/* ambient glow, layered translucent discs (no extra packages) */}
                    <Animated.View style={[styles.fill, styles.center, { opacity: glowOpacity }]}>
                        {[0.62, 0.46, 0.3].map((f, i) => (
                            <View
                                key={f}
                                style={{
                                    position: 'absolute',
                                    width: size * f,
                                    height: size * f,
                                    borderRadius: (size * f) / 2,
                                    backgroundColor: GOLD,
                                    opacity: 0.018 + i * 0.012,
                                }}
                            />
                        ))}
                    </Animated.View>

                    {/* hairline rings */}
                    {ORBITS.map((o) => {
                        const d = o.r * 2 * scale;
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
                        <Orbit key={`orbit-${o.r}`} size={size} diameter={o.r * 2 * scale} animate={animate} {...o} />
                    ))}

                    {/* wordmark */}
                    <View style={[styles.fill, styles.center]}>
                        <Animated.Text style={[styles.wordmark, { opacity: wordOpacity }]}>{label}</Animated.Text>
                    </View>
                </View>

                {/* hairline progress */}
                <View style={styles.track}>
                    <Animated.View style={[styles.sweep, { transform: [{ translateX: sweepX }] }]} />
                </View>

                <Animated.Text style={styles.subtext}>{subtext}</Animated.Text>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#050507',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        elevation: 999,
    },
    content: { alignItems: 'center', justifyContent: 'center' },
    fill: { ...StyleSheet.absoluteFillObject },
    center: { alignItems: 'center', justifyContent: 'center' },
    wordmark: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '200',
        letterSpacing: 9,
        marginLeft: 9, // offsets trailing letter-spacing so the word looks truly centred
    },
    track: {
        width: 96,
        height: 1,
        marginTop: 28,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    sweep: {
        width: 40,
        height: 1,
        backgroundColor: GOLD,
    },
    subtext: {
        marginTop: 16,
        color: 'rgba(255,255,255,0.38)',
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 3.5,
    },
});