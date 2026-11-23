import type { RootState } from '@/redux/store'
import { MessageCircle } from 'lucide-react-native'
import React, { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated'
import { useSelector } from 'react-redux'

export function ChatTabIcon({ color }: { color: string }) {
   const count = useSelector((s: RootState) => s.chatBadge.unreadChats)
    const [shown, setShown] = useState(count) // keeps the last number visible while fading out
    const prev = useRef(count)
    const visible = useSharedValue(count > 0 ? 1 : 0)
    const bump = useSharedValue(1)

    useEffect(() => {
        if (count > 0) setShown(count)
        visible.value = withSpring(count > 0 ? 1 : 0, { damping: 14, stiffness: 260 })
        if (count > prev.current) {
            bump.value = withSequence(
                withSpring(1.3, { damping: 8, stiffness: 400 }),
                withSpring(1, { damping: 10, stiffness: 260 })
            )
        }
        prev.current = count
    }, [count]) // eslint-disable-line react-hooks/exhaustive-deps

    const badge = useAnimatedStyle(() => ({
        opacity: visible.value,
        transform: [{ scale: visible.value * bump.value }],
    }))

    return (
        <View>
            <MessageCircle size={23} color={color} />
            <Animated.View
                pointerEvents="none"
                style={[
                    {
                        position: 'absolute',
                        top: -6,
                        right: -10,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#38bdf8',
                        borderWidth: 2,
                        borderColor: '#000',
                    },
                    badge,
                ]}
            >
                <Text style={{ color: '#000', fontSize: 10, fontWeight: '800', lineHeight: 12 }}>
                    {shown > 99 ? '99+' : shown}
                </Text>
            </Animated.View>
        </View>
    )
}