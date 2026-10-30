import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'

type RingProps = {
    size: number
    duration: number
    color: string
    dot: number
    reverse?: boolean
    twin?: boolean // a second dot on the opposite side
}

function Ring({ size, duration, color, dot, reverse, twin }: RingProps) {
    const rot = useSharedValue(0)

    useEffect(() => {
        rot.value = withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1, false)
        return () => cancelAnimation(rot)
    }, [duration, rot])

    const style = useAnimatedStyle(() => ({
        transform: [{ rotate: `${reverse ? -rot.value : rot.value}deg` }],
    }))

    const dotStyle = {
        position: 'absolute' as const,
        left: size / 2 - dot / 2,
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 1,
        shadowRadius: dot * 1.6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    }

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.07)',
                },
                style,
            ]}
        >
            <View style={[dotStyle, { top: -dot / 2 }]} />
            {twin ? <View style={[dotStyle, { top: size - dot / 2, opacity: 0.55 }]} /> : null}
        </Animated.View>
    )
}

function Core() {
    const pulse = useSharedValue(0)

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            false
        )
        return () => cancelAnimation(pulse)
    }, [pulse])

    const glow = useAnimatedStyle(() => ({
        opacity: 0.25 + pulse.value * 0.45,
        transform: [{ scale: 1 + pulse.value * 0.5 }],
    }))

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
                style={[
                    { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: '#38bdf8' },
                    glow,
                ]}
            />
            <View
                style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: '#e0f2fe',
                    shadowColor: '#38bdf8',
                    shadowOpacity: 1,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                }}
            />
        </View>
    )
}

/** The three-ring orbit animation on its own. `scale` shrinks it (and its layout box) for inline use. */
export function OrbitSpinner({ scale = 1 }: { scale?: number }) {
    const box = 140 * scale
    return (
        <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
            <View
                style={{
                    width: 140,
                    height: 140,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale }],
                }}
            >
                <Ring size={132} duration={2100} color="#6366f1" dot={5} reverse />
                <Ring size={96} duration={1400} color="#38bdf8" dot={6} twin />
                <Ring size={60} duration={950} color="#ffffff" dot={4} reverse />
                <Core />
            </View>
        </View>
    )
}

/** Premium dark orbit loader: black background, three counter-rotating rings with fast glowing dots. */
export function ChatOrbitLoader() {
    const textPulse = useSharedValue(0.35)

    useEffect(() => {
        textPulse.value = withRepeat(withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true)
        return () => cancelAnimation(textPulse)
    }, [textPulse])

    const textStyle = useAnimatedStyle(() => ({ opacity: textPulse.value }))

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(220)}
            pointerEvents="none"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#000',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <OrbitSpinner />

            <Animated.Text
                style={[
                    { marginTop: 26, color: '#a3a3a3', fontSize: 11, letterSpacing: 3.2, textTransform: 'uppercase' },
                    textStyle,
                ]}
            >
                Loading messages
            </Animated.Text>
        </Animated.View>
    )
}