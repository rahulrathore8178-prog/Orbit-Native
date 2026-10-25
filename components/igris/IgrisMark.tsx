import React, { useEffect, useMemo } from "react";
import Animated, {
    Easing,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Stop } from "react-native-svg";
import { W } from "./utils";

const AG = Animated.createAnimatedComponent(G);
const AEllipse = Animated.createAnimatedComponent(Ellipse);

const HELMET_PATH = "M100,10 L108,34 L128,46 L152,78 L140,100 L146,118 L122,148 L110,172 L100,192 L90,172 L78,148 L54,118 L60,100 L48,78 L72,46 L92,34 Z";
const EYE_LEFT = "M58,100 L80,93 L94,97 L80,104 Z";
const EYE_RIGHT = "M142,100 L120,93 L106,97 L120,104 Z";
const CRACK_LINES = [[152, 78, 178, 68], [48, 78, 22, 68], [140, 100, 172, 106], [60, 100, 28, 106], [122, 148, 144, 168], [78, 148, 56, 168]];

type Particle = { id: number; x: number; y: number; r: number; o: number };

function generateParticles(count = 50): Particle[] {
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
    return Array.from({ length: count }, (_, i) => {
        const hb = Math.pow(rand(), 2.2);
        const spread = 28 + hb * 58;
        return { id: i, x: 100 + (rand() - 0.5) * spread * 2, y: 4 + hb * 172, r: 0.35 + rand() * 1.05, o: 0.12 + (1 - hb) * 0.55 };
    });
}

/** One twinkling group of particles (own component => hooks are legal, no hooks-in-map). */
function ParticleGroup({ reveal, twinkle, items }: { reveal: SharedValue<number>; twinkle: SharedValue<number>; items: Particle[] }) {
    const ap = useAnimatedProps(() => ({ opacity: reveal.value * twinkle.value }));
    return (
        <AG animatedProps={ap}>
            {items.map((p) => <Circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill="#fff" opacity={p.o} />)}
        </AG>
    );
}

export default function IgrisMark({ size, powerOnDelay = 900 }: { size: number; powerOnDelay?: number }) {
    const reduce = useReducedMotion();
    const groups = useMemo(() => {
        const all = generateParticles();
        return [0, 1, 2].map((g) => all.filter((p) => p.id % 3 === g));
    }, []);

    const sphere = useSharedValue(reduce ? 1 : 0);
    const frame = useSharedValue(reduce ? 1 : 0);
    const parts = useSharedValue(reduce ? 1 : 0);
    const eyes = useSharedValue(reduce ? 1 : 0);
    const glow = useSharedValue(reduce ? 1 : 0);
    const glowS = useSharedValue(reduce ? 1 : 0.5);
    const pulse = useSharedValue(1);
    const tw0 = useSharedValue(1), tw1 = useSharedValue(1), tw2 = useSharedValue(1);
    const twinkles = [tw0, tw1, tw2];

    useEffect(() => {
        const sin = Easing.inOut(Easing.sin);
        twinkles.forEach((v, i) => {
            v.value = withDelay(i * 900, withRepeat(withSequence(withTiming(0.3, { duration: 2000, easing: sin }), withTiming(1, { duration: 2000, easing: sin })), -1));
        });
        if (reduce) return;

        const d = powerOnDelay, out = Easing.out(Easing.sin), io = Easing.inOut(Easing.sin);
        const t = (v: number, ms: number) => withTiming(v, { duration: ms });
        const breathe = () => withRepeat(withSequence(withTiming(0.55, { duration: 2200, easing: io }), withTiming(1, { duration: 2200, easing: io })), -1);

        sphere.value = withDelay(d, withTiming(1, { duration: 1300, easing: out }));
        parts.value = withDelay(d + 150, withTiming(1, { duration: 1600, easing: out }));
        frame.value = withDelay(d + 350, withTiming(1, { duration: 1000, easing: out }));
        eyes.value = withDelay(d + 1100, withSequence(
            t(1, 50), t(1, 50), t(0.1, 60), t(0.1, 60), t(1, 70), t(1, 60), t(0.25, 50), t(0.25, 50),
            withTiming(1, { duration: 400, easing: out }), withDelay(350, breathe()),
        ));
        glow.value = withDelay(d + 1550, withSequence(withTiming(1, { duration: 700, easing: out }), breathe()));
        glowS.value = withDelay(d + 1550, withTiming(1, { duration: 700, easing: out }));
        pulse.value = withDelay(d + 1900, withRepeat(withSequence(withTiming(1.015, { duration: 3600, easing: io }), withTiming(1, { duration: 3600, easing: io })), -1));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const pSphere = useAnimatedProps(() => ({ opacity: sphere.value }));
    const pFrame = useAnimatedProps(() => ({ opacity: frame.value }));
    const pEyes = useAnimatedProps(() => ({ opacity: eyes.value }));
    const pGlow = useAnimatedProps(() => ({ opacity: glow.value, rx: 66 * glowS.value, ry: 26 * glowS.value }));
    const root = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    return (
        <Animated.View style={[{ width: size, height: size }, root]}>
            <Svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
                <Defs>
                    <RadialGradient id="ambient" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff" stopOpacity={0.1} /><Stop offset="0.65" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                    <RadialGradient id="core" cx="50%" cy="48%" r="55%"><Stop offset="0" stopColor="#fff" stopOpacity={0.05} /><Stop offset="0.7" stopColor="#fff" stopOpacity={0.015} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                    <RadialGradient id="eyeGlow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff" stopOpacity={0.45} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                </Defs>

                <Circle cx="100" cy="100" r="108" fill="url(#ambient)" />

                <AG animatedProps={pSphere}>
                    <Circle cx="100" cy="100" r="92" fill="url(#core)" />
                    <Circle cx="100" cy="100" r="92" fill="none" stroke={W(0.16)} strokeWidth={1} />
                    <Circle cx="100" cy="100" r="93" fill="none" stroke={W(0.12)} strokeWidth={5} />
                    <Path d="M42,52 A98,98 0 0 1 42,148" fill="none" stroke={W(0.1)} strokeWidth={0.75} />
                    <Path d="M158,52 A98,98 0 0 0 158,148" fill="none" stroke={W(0.1)} strokeWidth={0.75} />
                    {CRACK_LINES.map((l, i) => (
                        <G key={i}>
                            <Line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={W(0.14)} strokeWidth={0.6} />
                            <Circle cx={l[2]} cy={l[3]} r={1.1} fill={W(0.4)} />
                        </G>
                    ))}
                </AG>

                {groups.map((items, g) => <ParticleGroup key={g} reveal={parts} twinkle={twinkles[g]} items={items} />)}

                <AG animatedProps={pFrame}>
                    <Path d={HELMET_PATH} fill="rgba(10,10,12,0.55)" stroke={W(0.34)} strokeWidth={1.4} strokeLinejoin="round" />
                    <Path d="M100,10 L100,86" stroke={W(0.22)} strokeWidth={1} />
                    <Path d="M100,110 L100,192" stroke={W(0.22)} strokeWidth={1} />
                    <Path d="M100,88 L104,94 L100,100 L96,94 Z" fill={W(0.12)} stroke={W(0.3)} strokeWidth={0.6} />
                    <Path d="M108,34 L140,100" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M92,34 L60,100" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M152,78 L122,148" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M48,78 L78,148" stroke={W(0.09)} strokeWidth={0.75} />
                </AG>

                <AEllipse animatedProps={pGlow} cx="100" cy="98" rx="66" ry="26" fill="url(#eyeGlow)" />

                <AG animatedProps={pEyes}>
                    <Path d={EYE_LEFT} fill="#fff" opacity={0.25} stroke="#fff" strokeWidth={4} strokeOpacity={0.25} />
                    <Path d={EYE_RIGHT} fill="#fff" opacity={0.25} stroke="#fff" strokeWidth={4} strokeOpacity={0.25} />
                    <Path d={EYE_LEFT} fill="#fff" />
                    <Path d={EYE_RIGHT} fill="#fff" />
                </AG>
            </Svg>
        </Animated.View>
    );
}
