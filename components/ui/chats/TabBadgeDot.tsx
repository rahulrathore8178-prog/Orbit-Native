import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { useSelector } from 'react-redux'
import { MessageCircle } from 'lucide-react-native'

function Dot({ visible }: { visible: boolean }) {
    const scale = useRef(new Animated.Value(0)).current
    const [mounted, setMounted] = useState(visible)

    useEffect(() => {
        if (visible) {
            setMounted(true)
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start()
        } else {
            Animated.timing(scale, {
                toValue: 0,
                duration: 160,
                easing: Easing.in(Easing.back(2)),
                useNativeDriver: true,
            }).start(({ finished }) => finished && setMounted(false))
        }
    }, [visible, scale])

    if (!mounted) return null
    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 11,
                height: 11,
                borderRadius: 6,
                backgroundColor: '#ef4444',
                borderWidth: 1.5,
                borderColor: '#000',
                transform: [{ scale }],
            }}
        />
    )
}

export function ChatTabIcon({ color }: { color: string }) {
    const hasUnread = useSelector((s: any) => s.chatBadge.hasUnread)
    return (
        <View>
            <MessageCircle size={23} color={color} />
            <Dot visible={hasUnread} />
        </View>
    )
}