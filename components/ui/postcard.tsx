import '@/global.css'
import React from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'

// Base URL for images when backend returns a relative path.
// TODO: move to shared config if needed.
const BASE_URL = 'http://10.36.40.37:5000'

type PostcardProps = {
    content: string
    image?: string
    author?: {
        username: string
        profilePic?: string
    }
    createdAt?: string
    likesCount?: number
    commentsCount?: number
    isLikedByCurrentUser?: boolean
    id?: string
    handleLike?: (postId: string, isLiked: boolean) => void
}

const timeAgo = (dateString?: string) => {
    if (!dateString) return ''
    const diffMs = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
}

const Postcard = ({ content, image, author, createdAt, likesCount, commentsCount, isLikedByCurrentUser, handleLike, id }: PostcardProps) => {
    const resolvedImageUri = image
    ? image.startsWith('http')
    ? image
    : `${BASE_URL}${image.startsWith('/') ? '' : '/'}${image}`
    : undefined
    const hasMedia = Boolean(resolvedImageUri)

    return (
        <View className="bg-gray-950 rounded-2xl px-4 py-4 mb-3 border border-gray-800">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1">
                    {author?.profilePic ? (
                        <Image
                            source={{ uri: author.profilePic }}
                            className="w-9 h-9 rounded-full bg-gray-700 mr-3"
                        />
                    ) : (
                        <View className="w-9 h-9 rounded-full bg-gray-700 mr-3 items-center justify-center">
                            <Text className="text-gray-300 text-xs">
                                {author?.username?.charAt(0)?.toUpperCase() ?? '?'}
                            </Text>
                        </View>
                    )}
                    <View>
                        <Text className="text-gray-100 text-sm font-semibold">
                            {author?.username ?? 'Unknown'}
                        </Text>
                    </View>
                </View>
                <Text className="text-gray-500 text-xs">{timeAgo(createdAt)}</Text>
            </View>

            {/* Content */}
            {content ? (
                <Text className="text-gray-200 text-sm leading-5 mb-3">{content}</Text>
            ) : null}

            {/* Media */}
            {hasMedia && (
                <View className="rounded-xl overflow-hidden bg-gray-800 h-200 mb-3">
                    {resolvedImageUri ? (
                        <Image
                            source={{ uri: resolvedImageUri }}
                            className="w-full h-80"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-80 items-center justify-center">
                            <Text className="text-gray-500 text-xs">Video attached</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Footer */}
            <View className="flex-row items-center mt-1">
                <View className="flex-row items-center mr-5">
                    <TouchableOpacity
                        onPress={() => {
                            console.log('Postcard like pressed', { id, isLikedByCurrentUser });
                            if (!id || !handleLike) return;
                            handleLike(id, !Boolean(isLikedByCurrentUser));
                        }}
                        activeOpacity={0.7}
                        className="mr-1"
                    >
                        <Text className="text-sm">{isLikedByCurrentUser ? '❤️' : '🤍'}</Text>
                    </TouchableOpacity>
                    <Text className="text-gray-400 text-xs">{likesCount}</Text>
                </View>
                <View className="flex-row items-center">
                    <Text className="text-sm mr-1">💬</Text>
                    <Text className="text-gray-400 text-xs">{commentsCount}</Text>
                </View>
            </View>
        </View>
    )
}

export default Postcard