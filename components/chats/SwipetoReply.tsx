import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { ReactNode, useCallback, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    interpolate, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'

const THRESHOLD = 58 // px you must drag to arm the reply
const MAX_PULL = 82 // the bubble never travels further than this

const pull = (t: number) => {
    'worklet'
    return t <= THRESHOLD ? t : Math.min(MAX_PULL, THRESHOLD + (t - THRESHOLD) * 0.3) // firm resistance past the threshold
}
const buzz = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }) }

export function SwipeToReply({ enabled, isMe, onReply, children }: { enabled: boolean; isMe: boolean; onReply: () => void; children: ReactNode }) {
    const x = useSharedValue(0)
    const armed = useSharedValue(false)
    const pop = useSharedValue(1)

    const cb = useRef(onReply)
    cb.current = onReply
    const fire = useCallback(() => cb.current(), [])

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .enabled(enabled)
                .activeOffsetX(12) // only a left-to-right drag claims the touch
                .failOffsetX(-12)
                .failOffsetY([-14, 14]) // a vertical scroll never turns into a swipe
                .onUpdate((e) => {
                    'worklet'
                    x.value = pull(Math.max(0, e.translationX))
                    if (!armed.value && x.value >= THRESHOLD) {
                        armed.value = true
                        pop.value = withSequence(withTiming(1.3, { duration: 90 }), withSpring(1, { damping: 10 }))
                        runOnJS(buzz)()
                    } else if (armed.value && x.value < THRESHOLD - 10) {
                        armed.value = false
                    }
                })
                .onEnd(() => {
                    'worklet'
                    if (armed.value) runOnJS(fire)()
                })
                .onFinalize(() => {
                    'worklet'
                    armed.value = false
                    x.value = withSpring(0, { damping: 20, stiffness: 280, mass: 0.7 })
                }),
        [enabled, x, armed, pop, fire]
    )

    const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
    const iconStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [8, THRESHOLD * 0.7, THRESHOLD], [0, 0.6, 1], 'clamp'),
        transform: [{ scale: interpolate(x.value, [0, THRESHOLD], [0.5, 1], 'clamp') * pop.value }],
        backgroundColor: interpolateColor(x.value, [THRESHOLD - 8, THRESHOLD], ['rgba(255,255,255,0.1)', 'rgba(56,189,248,0.9)']),
    }))

    return (
        <GestureDetector gesture={pan}>
            <Animated.View className={`flex-row ${isMe ? 'justify-end' : 'justify-start'}`} style={rowStyle}>
                {/* zero-width slot right before the bubble: the icon trails it as it moves */}
                <View className="w-0">
                    <Animated.View
                        className="absolute right-3 h-9 w-9 items-center justify-center rounded-full"
                        style={[{ top: '50%', marginTop: -18 }, iconStyle]}
                    >
                        <Ionicons name="arrow-undo" size={17} color="#fff" />
                    </Animated.View>
                </View>
                {children}
            </Animated.View>
        </GestureDetector>
    )
}