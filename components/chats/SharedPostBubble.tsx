import { useSharedPost, type SharedPostData } from '../services/chat/sharedPost'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import React, { memo, useCallback, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { API_URL, getDisplayImageUrl } from '../../lib/utils'
import { clampAspectRatio, formatDuration, withHost } from '../services/feed/postUtils'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { router } from 'expo-router'
import { useVideoThumb } from '@/hooks/sharedPost/useVideoThumb'
import { Animated } from 'react-native'

type Props = {
    postId: string
    initialPost?: SharedPostData
    isMe: boolean
    onLongPress: () => void
}

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 }

const timeAgo = (iso?: string) => {
    if (!iso) return ''
    const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 3600) return `${Math.floor(s / 60) || 1}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    if (s < 604800) return `${Math.floor(s / 86400)}d`
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

/* ───────────── Media ───────────── */

// Play button starts the inline player; a tap anywhere else on the bubble opens the post.
const VideoBox = ({ uri, thumb }: { uri: string; thumb?: string }) => {
    const [active, setActive] = useState(false)
    return active ? <ActiveVideo uri={uri} /> : (
        <Pressable onPress={() => setActive(true)} className="flex-1 items-center justify-center bg-black">
            {thumb ? <Image source={{ uri: thumb }} resizeMode="cover" className="absolute inset-0 h-full w-full" /> : null}
            <View className="h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/40">
                <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
            </View>
        </Pressable>
    )
}

// Player is created only after the first tap, so a chat full of shared videos stays light.
const ActiveVideo = ({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true
        p.play()
    })
    return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
}

const AudioClip = ({ uri, duration }: { uri: string; duration?: number }) => {
    const player = useAudioPlayer(uri)
    const status = useAudioPlayerStatus(player)
    const playing = Boolean(status?.playing)
    const total = status?.duration || duration || 0
    const progress = total > 0 ? Math.min(100, ((status?.currentTime || 0) / total) * 100) : 0

    const toggle = () => {
        try {
            if (playing) return player.pause()
            if (status?.didJustFinish) player.seekTo(0)
            player.play()
        } catch { }
    }

    return (
        <View className="flex-row items-center rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <TouchableOpacity onPress={toggle} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#fff" style={playing ? undefined : { marginLeft: 2 }} />
            </TouchableOpacity>
            <View className="flex-1">
                <View className="h-1 overflow-hidden rounded-full bg-white/20">
                    <View className="h-full bg-white" style={{ width: `${progress}%` }} />
                </View>
                <Text className="mt-1.5 text-[11px] text-white/80">{formatDuration(total)}</Text>
            </View>
        </View>
    )
}

/* ───────────── Bubble ───────────── */

export const SharedPostBubble = memo(function SharedPostBubble({ postId, initialPost, isMe, onLongPress }: Props) {
    const { width } = useWindowDimensions()
    const { post, failed } = useSharedPost(postId, initialPost)

    const scale = useSharedValue(1)
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

    // Hooks must run before any early return.
    const videoUri = withHost(post?.video)
    const videoThumb = useVideoThumb(postId, videoUri)

    const open = useCallback(
        () => router.push({ pathname: '/profile/savedPosts/[postId]', params: { postId } }),
        [postId],
    )

    const bubbleWidth = Math.min(width * 0.72, 300)
    const mediaWidth = bubbleWidth - 16 // 8px padding each side
    const shell = `overflow-hidden rounded-2xl border p-2 ${isMe ? 'rounded-br-md border-blue-400/20 bg-blue-900' : 'rounded-bl-md border-white/10 bg-neutral-900'}`

    if (!post) {
        return (
            <Pressable onLongPress={onLongPress} delayLongPress={250} className={shell} style={{ width: bubbleWidth }}>
                <View className="items-center justify-center rounded-xl bg-black/30" style={{ height: mediaWidth * 0.75 }}>
                    {failed ? (
                        <View className="items-center">
                            <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
                            <Text className="mt-2 text-xs text-white/60">Post unavailable</Text>
                        </View>
                    ) : (
                        <ActivityIndicator color="#fff" />
                    )}
                </View>
            </Pressable>
        )
    }

    const audioUri = withHost(post.voiceNote)
    const imageUri = post.image ? (post.image.startsWith('/') ? `${API_URL}${post.image}` : getDisplayImageUrl(post.image)) : undefined
    const hasVideo = !!videoUri
    const hasAudio = !!audioUri && !hasVideo
    const hasImage = !!imageUri && !hasVideo && !hasAudio
    const hasMedia = hasVideo || hasAudio || hasImage

    const ratio = post.mediaWidth && post.mediaHeight ? post.mediaWidth / post.mediaHeight : hasVideo ? 9 / 16 : 4 / 5
    const box = { width: mediaWidth, height: mediaWidth / clampAspectRatio(ratio) }

    const { author } = post
    const showStats = post.likesCount !== undefined || post.commentsCount !== undefined
    const avatarUri = withHost(author?.profilePic)

    return (
        <Animated.View style={[{ width: bubbleWidth }, pressStyle]}>
            <Pressable
                onPress={open}
                onLongPress={onLongPress}
                delayLongPress={250}
                onPressIn={() => (scale.value = withSpring(0.98, SPRING))}
                onPressOut={() => (scale.value = withSpring(1, SPRING))}
                className={shell}
            >
                {/* Author */}
                {author ? (
                    <View className="flex-row items-center px-1 pb-2 pt-0.5">
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} className="h-7 w-7 rounded-full border border-white/20 bg-white/10" />
                        ) : (
                            <View className="h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10">
                                <Text className="text-[11px] font-bold text-white">{author.username?.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <Text numberOfLines={1} className="ml-2 flex-1 text-[13px] font-semibold text-white">{author.username}</Text>
                        {post.createdAt ? <Text className="text-[11px] text-white/45">{timeAgo(post.createdAt)}</Text> : null}
                    </View>
                ) : null}

                {/* Media */}
                {hasVideo && (
                    <View className="overflow-hidden rounded-xl bg-black" style={box}>
                        <VideoBox uri={videoUri!} thumb={videoThumb} />
                    </View>
                )}
                {hasAudio && <AudioClip uri={audioUri!} duration={post.voiceNoteDuration} />}
                {hasImage && (
                    <View className="overflow-hidden rounded-xl bg-black/30" style={box}>
                        <Image source={{ uri: imageUri! }} blurRadius={22} resizeMode="cover" className="absolute inset-0 h-full w-full opacity-50" style={{ transform: [{ scale: 1.15 }] }} />
                        <Image source={{ uri: imageUri! }} resizeMode="contain" className="absolute inset-0 h-full w-full" />
                    </View>
                )}

                {/* Caption */}
                {post.content ? (
                    hasMedia ? (
                        <Text numberOfLines={3} className={`px-1 pt-2.5 text-[13px] leading-[19px] ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>
                            {post.content}
                        </Text>
                    ) : (
                        <View className="mx-1 my-1 border-l-2 border-white/15 py-0.5 pl-3">
                            <Text numberOfLines={8} className={`text-[15px] leading-[22px] ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>
                                {post.content}
                            </Text>
                        </View>
                    )
                ) : null}

                {/* Footer */}
                <View className="mt-2.5 flex-row items-center border-t border-white/10 px-1 pt-2">
                    {showStats ? (
                        <>
                            <Ionicons name="heart-outline" size={14} color="rgba(255,255,255,0.6)" />
                            <Text className="ml-1 mr-3 text-[12px] text-white/60">{compact(post.likesCount ?? 0)}</Text>
                            <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.6)" />
                            <Text className="ml-1 text-[12px] text-white/60">{compact(post.commentsCount ?? 0)}</Text>
                        </>
                    ) : null}
                    <View className="flex-1" />
                    <Text className="text-[12px] font-semibold text-white/75">View post</Text>
                    <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.75)" />
                </View>
            </Pressable>
        </Animated.View>
    )
})
