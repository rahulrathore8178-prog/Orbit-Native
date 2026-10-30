import { Avatar } from '@/components/ui/chats/ui'
import { useConversations } from '@/hooks/chats/useConversation'
import { RootState } from '@/redux/store'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { useSelector } from 'react-redux'

const BTN = 44
const ROW = 54
const GAP = 12
const W = 214
const SLACK = 34

const Item = memo(function Item({ f, index, unread, hover, prog }: {
    f: { _id: string; username: string; profilePic?: string }
    index: number
    unread: number
    hover: Animated.SharedValue<number>
    prog: Animated.SharedValue<number>
}) {
    const style = useAnimatedStyle(() => {
        const on = hover.value === index
        return {
            opacity: interpolate(prog.value, [0.1 + index * 0.08, 0.6 + index * 0.08], [0, 1], 'clamp'),
            backgroundColor: withTiming(on ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0)', { duration: 110 }),
            transform: [
                { scale: withSpring(on ? 1.06 : 1, { damping: 15, stiffness: 320 }) },
                { translateX: withSpring(on ? -6 : 0, { damping: 15, stiffness: 320 }) },
            ],
        }
    })
    return (
        <Animated.View style={[{ height: ROW }, style]} className="flex-row items-center gap-3 rounded-full pl-4 pr-1.5">
            <Text numberOfLines={1} className="flex-1 text-[14.5px] font-semibold text-white">{f.username}</Text>
            {unread > 0 && (
                <View className="min-w-[20px] items-center rounded-full bg-sky-400 px-1.5 py-[1px]">
                    <Text className="text-[11px] font-bold text-black">{unread > 99 ? '99+' : unread}</Text>
                </View>
            )}
            <Avatar uri={f.profilePic} name={f.username} className="h-11 w-11" />
        </Animated.View>
    )
})

/** Tap = hint. Hold, drag onto a chat and release = switch. Badge = unread in your other chats. */
export function QuickChats({ currentId, onHint }: { currentId: string; onHint: (t: string) => void }) {
    const friends = useSelector((s: RootState) => s.friends.friends)
    const { conversations } = useConversations()

    const top = useMemo(() => {
        const ts = (id: string) => (conversations[id]?.timestamp ? new Date(conversations[id].timestamp).getTime() || 0 : 0)
        return friends.filter((f) => f._id !== currentId && conversations[f._id]).sort((a, b) => ts(b._id) - ts(a._id)).slice(0, 5)
    }, [friends, conversations, currentId])

    const badge = useMemo(
        () => Object.entries(conversations).reduce((n, [id, c]) => (id === currentId ? n : n + (c.unread || 0)), 0),
        [conversations, currentId]
    )

    const topRef = useRef(top)
    topRef.current = top

    const hover = useSharedValue(-1)
    const prog = useSharedValue(0)
    const count = useSharedValue(0)
    const active = useSharedValue(false)
    useEffect(() => { count.value = top.length }, [top.length, count])

    useAnimatedReaction(
        () => hover.value,
        (cur, prev) => { if (cur >= 0 && cur !== prev) runOnJS(Haptics.selectionAsync)() }
    )

    const open = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }) }, [])
    const hint = useCallback(() => onHint('Tap and hold to switch chats'), [onHint])
    const go = useCallback((idx: number) => {
        const f = topRef.current[idx]
        if (f) router.replace({ pathname: '/chats/[id]', params: { id: f._id } } as any)
    }, [])

    const gesture = useMemo(() => {
        const pan = Gesture.Pan()
            .activateAfterLongPress(220)
            .shouldCancelWhenOutside(false)
            .onStart(() => {
                'worklet'
                active.value = true
                hover.value = -1
                prog.value = withSpring(1, { damping: 16, stiffness: 260, mass: 0.7 })
                runOnJS(open)()
            })
            .onUpdate((e) => {
                'worklet'
                const d = -GAP - e.y // e.x / e.y are relative to the button
                const inX = e.x > BTN - W - SLACK && e.x < BTN + SLACK
                let idx = -1
                if (inX && d >= 0) {
                    idx = Math.floor(d / ROW)
                    if (idx >= count.value) idx = -1
                }
                if (idx !== hover.value) hover.value = idx
            })
            .onFinalize(() => {
                'worklet'
                if (!active.value) return
                active.value = false
                const idx = hover.value
                prog.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) })
                hover.value = -1
                if (idx >= 0) runOnJS(go)(idx)
            })
        const tap = Gesture.Tap().maxDuration(200).onEnd((_e, ok) => {
            'worklet'
            if (ok) runOnJS(hint)()
        })
        return Gesture.Exclusive(pan, tap)
    }, [active, hover, prog, count, open, go, hint])

    const panel = useAnimatedStyle(() => ({
        opacity: interpolate(prog.value, [0, 0.4], [0, 1], 'clamp'),
        transform: [
            { translateY: interpolate(prog.value, [0, 1], [16, 0], 'clamp') },
            { scale: interpolate(prog.value, [0, 1], [0.92, 1], 'clamp') },
        ],
    }))
    const btn = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(active.value ? 1.12 : 1, { damping: 14, stiffness: 260 }) }] }))

    return (
        <View style={{ width: BTN, height: BTN, zIndex: 50, elevation: 20 }}>
            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={btn}
                    collapsable={false}
                    accessibilityLabel="Recent chats (hold and drag)"
                    className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07]"
                >
                    <Ionicons name="people" size={20} color="#d4d8e1" />
                    {badge > 0 && (
                        <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full bg-sky-400 px-1 py-[1px]">
                            <Text className="text-[10px] font-bold text-black">{badge > 99 ? '99+' : badge}</Text>
                        </View>
                    )}
                </Animated.View>
            </GestureDetector>

            <Animated.View
                pointerEvents="none"
                style={[{ position: 'absolute', right: 0, bottom: BTN + GAP, width: W, flexDirection: 'column-reverse' }, panel]}
                className="rounded-[28px] border border-white/10 bg-neutral-900/95 p-1.5"
            >
                {top.length === 0 ? (
                    <View style={{ height: ROW }} className="items-center justify-center">
                        <Text className="text-[13px] text-gray-400">No other chats yet</Text>
                    </View>
                ) : (
                    top.map((f, i) => (
                        <Item key={f._id} f={f} index={i} unread={conversations[f._id]?.unread ?? 0} hover={hover} prog={prog} />
                    ))
                )}
            </Animated.View>
        </View>
    )
}