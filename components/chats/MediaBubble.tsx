import { Message } from '@/hooks/chats/useChat'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import React, { memo } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { VoiceBubble } from '@/components/comments/CommentMedia'

const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export const MediaBubble = memo(function MediaBubble({
    item, isMe, tail, onLongPress, onOpenImage, onOpenVideo, onRetry, onDiscard,
}: {
    item: Message
    isMe: boolean
    tail: boolean
    onLongPress: (m: Message) => void
    onOpenImage: (url: string) => void
    onOpenVideo: (url: string) => void
    onRetry: (m: Message) => void
    onDiscard: (m: Message) => void
}) {
    const { width } = useWindowDimensions()
    const media = item.media!
    const sending = item.status === 'sending'
    const failed = item.status === 'failed'
    const hasCaption = !!item.content
    const isSticker = media.type === 'sticker'
    const isAudio = media.type === 'audio'

    const maxW = Math.min(width * 0.7, 300)
    const ratio = Math.min(Math.max(media.width && media.height ? media.width / media.height : media.type === 'video' ? 9 / 16 : 1, 0.6), 1.6)
    const w = isSticker ? 140 : maxW
    const h = isSticker ? 140 : Math.min(w / ratio, 380)

    const timeChip = (
        <View className="flex-row items-center gap-1">
            {item.edited && <Text className="text-[10px] italic text-white/70">edited</Text>}
            <Text className="text-[10px] text-white/80">{sending ? 'sending…' : item.time}</Text>
            {isMe && !sending && !failed && (
                <Ionicons name={item.read ? 'checkmark-done' : 'checkmark'} size={13} color={item.read ? '#38bdf8' : 'rgba(255,255,255,0.75)'} />
            )}
        </View>
    )

    const body = isAudio ? (
        <View className="px-1.5 py-1.5"><VoiceBubble uri={media.url} duration={media.duration ?? 0} seed={item.id} /></View>
    ) : (
        <Pressable
            onPress={() => (media.type === 'video' ? onOpenVideo(media.url) : media.type === 'image' ? onOpenImage(media.url) : undefined)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={250}
            disabled={sending}
            style={{ width: w, height: h }}
            className={`overflow-hidden ${isSticker ? '' : 'rounded-[20px] bg-white/5'}`}
        >
            {media.type === 'video' ? (
                <View className="flex-1 items-center justify-center bg-neutral-900">
                    <View className="h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/50">
                        <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
                    </View>
                    {!!media.duration && (
                        <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
                            <Text className="text-[10px] font-semibold text-white">{fmt(media.duration)}</Text>
                        </View>
                    )}
                </View>
            ) : (
                <Image source={{ uri: media.url }} style={{ width: '100%', height: '100%' }} contentFit={isSticker ? 'contain' : 'cover'} transition={150} cachePolicy="memory-disk" recyclingKey={media.url} />
            )}
            {media.type === 'gif' && (
                <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5"><Text className="text-[10px] font-extrabold text-white">GIF</Text></View>
            )}
            {sending && (
                <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <ActivityIndicator color="#fff" />
                    <View className="mt-2 h-[3px] w-3/5 overflow-hidden rounded-full bg-white/25">
                        <View className="h-full bg-white" style={{ width: `${Math.max(6, Math.round((item.progress ?? 0) * 100))}%` }} />
                    </View>
                </View>
            )}
            {!hasCaption && !isSticker && (
                <View className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5">{timeChip}</View>
            )}
        </Pressable>
    )

    if (isSticker) {
        return <Pressable onLongPress={() => onLongPress(item)}>{body}</Pressable>
    }

    return (
        <View
            className={`rounded-[24px] border p-1 ${isMe ? 'border-blue-400/20 bg-[#0f2a6b]' : 'border-white/10 bg-[#17171a]'} ${tail ? (isMe ? 'rounded-br-md' : 'rounded-bl-md') : ''}`}
        >
            {body}
            {(hasCaption || isAudio) && (
                <View className="px-2.5 pb-1.5 pt-1.5">
                    {hasCaption && <Text className={`text-[14.5px] leading-5 ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>{item.content}</Text>}
                    <View className="mt-0.5 self-end">{timeChip}</View>
                </View>
            )}
            {failed && (
                <View className="flex-row items-center justify-end gap-4 px-2.5 pb-1.5 pt-1">
                    <Text className="text-xs font-bold text-red-400">Couldn't send</Text>
                    <Pressable onPress={() => onRetry(item)} hitSlop={8}><Text className="text-xs font-extrabold text-sky-400">Retry</Text></Pressable>
                    <Pressable onPress={() => onDiscard(item)} hitSlop={8}><Text className="text-xs font-bold text-white/60">Discard</Text></Pressable>
                </View>
            )}
        </View>
    )
})

function PlayingVideo({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, (p) => { p.loop = false; p.play() })
    return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: '100%' }} />
}

/** Full-screen video. The player only exists while it is open. */
export function VideoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
    const insets = useSafeAreaInsets()
    return (
        <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View className="flex-1 bg-black">
                {uri ? <PlayingVideo uri={uri} /> : null}
                <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    accessibilityLabel="Close video"
                    style={{ top: insets.top + 10 }}
                    className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-black/60"
                >
                    <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
            </View>
        </Modal>
    )
}