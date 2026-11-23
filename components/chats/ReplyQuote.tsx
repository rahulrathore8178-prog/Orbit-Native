import type { ReplyRef } from '@/hooks/chats/useChat'
import type { IconName } from '@/components/ui/chats/ui'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import React, { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated'

export function replyLabel(r: ReplyRef): { icon: IconName | null; text: string } {
    if (r.text) return { icon: null, text: r.text }
    switch (r.mediaType) {
        case 'image': return { icon: 'camera', text: 'Photo' }
        case 'video': return { icon: 'videocam', text: 'Video' }
        case 'audio': return { icon: 'mic', text: 'Voice message' }
        case 'gif': return { icon: 'happy', text: 'GIF' }
        case 'sticker': return { icon: 'happy', text: 'Sticker' }
    }
    if (r.isPost) return { icon: 'paper-plane', text: 'Shared post' }
    return { icon: null, text: 'Message' }
}

const Preview = ({ reply, className = 'text-white/70' }: { reply: ReplyRef; className?: string }) => {
    const l = replyLabel(reply)
    return (
        <View className="flex-row items-center gap-1">
            {l.icon && <Ionicons name={l.icon} size={13} color="rgba(255,255,255,0.65)" />}
            <Text numberOfLines={2} className={`shrink text-[13px] ${className}`}>{l.text}</Text>
        </View>
    )
}

/** The quoted block inside (or above) a bubble. Tap to jump to the original. */
export const ReplyQuote = memo(function ReplyQuote({ reply, name, onPress }: { reply: ReplyRef; name: string; onPress?: () => void }) {
    const mine = reply.sender === 'me'
    return (
        <Pressable onPress={onPress} className="mb-1.5 flex-row overflow-hidden rounded-xl bg-black/25 active:opacity-80">
            <View className={`w-[3px] ${mine ? 'bg-sky-400' : 'bg-violet-400'}`} />
            <View className="min-w-[110px] shrink px-2.5 py-1.5">
                <Text numberOfLines={1} className="text-[12px] font-semibold" style={{ color: mine ? '#7dd3fc' : '#c4b5fd' }}>{name}</Text>
                <Preview reply={reply} />
            </View>
            {!!reply.mediaUrl && <Image source={{ uri: reply.mediaUrl }} style={{ width: 44, height: 44 }} contentFit="cover" />}
        </Pressable>
    )
})

export function ForwardedTag({ tone = 'plain', className = '' }: { tone?: 'me' | 'them' | 'plain'; className?: string }) {
    const c = tone === 'me' ? 'rgba(191,219,254,0.65)' : 'rgba(255,255,255,0.5)'
    return (
        <View className={`mb-1 flex-row items-center gap-1 self-start ${className}`}>
            <Ionicons name="arrow-redo" size={11} color={c} />
            <Text className={`text-[11px] italic ${tone === 'me' ? 'text-blue-200/65' : 'text-white/50'}`}>Forwarded</Text>
        </View>
    )
}

/** The bar above the composer while you are replying. */
export function ReplyBar({ reply, name, onCancel }: { reply: ReplyRef; name: string; onCancel: () => void }) {
    const mine = reply.sender === 'me'
    return (
        <Animated.View
            entering={FadeIn.duration(120)}
            exiting={FadeOut.duration(100)}
            className="mb-2 flex-row items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]"
        >
            <View className={`w-1 self-stretch ${mine ? 'bg-sky-400' : 'bg-violet-400'}`} />
            <View className="flex-1 px-3 py-2">
                <Text numberOfLines={1} className="text-[12px] font-semibold" style={{ color: mine ? '#7dd3fc' : '#c4b5fd' }}>Replying to {name}</Text>
                <Preview reply={reply} className="text-gray-400" />
            </View>
            {!!reply.mediaUrl && <Image source={{ uri: reply.mediaUrl }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />}
            <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Cancel reply" className="h-10 w-10 items-center justify-center">
                <Ionicons name="close" size={18} color="#a3a3a3" />
            </Pressable>
        </Animated.View>
    )
}