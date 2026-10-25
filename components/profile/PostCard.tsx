import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react-native';
import { GlassPanel } from '@/components/ui/neo';
import { formatTimeAgo } from '@/components/services/formatTimeAgo';
import { ProfilePost } from '@/components/profile/profile';

const ICON = 24;
const MUTED = '#d1d5db';

type Props = {
    post: ProfilePost;
    canDelete: boolean;
    onDelete: (id: string) => void;
    onSavePost: (id: string) => void;
    onShare: (post: ProfilePost) => void;
};

export default function PostCard({ post, canDelete, onDelete, onSavePost, onShare }: Props) {
    return (
        <GlassPanel radius={28} style={{ padding: 16 }}>
            <View className="flex-row items-center justify-between">
                <Text className="text-xs text-neutral-400">{formatTimeAgo(post.updatedAt)}</Text>
                {canDelete && (
                    <Pressable onPress={() => onDelete(post.id)} hitSlop={12} accessibilityLabel="Delete post">
                        <Trash2 size={20} color="#f87171" strokeWidth={1} />
                    </Pressable>
                )}
            </View>

            {post.image ? (
                <View className="mt-3 aspect-square overflow-hidden rounded-2xl bg-black/40">
                    <Image
                        source={{ uri: post.image }}
                        blurRadius={22}
                        resizeMode="cover"
                        className="absolute inset-0 h-full w-full opacity-[0.55]"
                        style={{ transform: [{ scale: 1.15 }] }}
                    />
                    <Image source={{ uri: post.image }} resizeMode="contain" className="h-full w-full" />
                </View>
            ) : null}

            {post.content ? (
                <Text className="mt-3 text-[15px] leading-[22px] text-white">{post.content}</Text>
            ) : null}

            <View className="mt-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-6">
                    <View className="flex-row items-center gap-2">
                        <Heart size={ICON} color={MUTED} strokeWidth={2} />
                        <Text className="text-base font-medium text-white">{post.likesCount}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <MessageCircle size={ICON} color={MUTED} strokeWidth={2} />
                        <Text className="text-base font-medium text-white">{post.commentsCount}</Text>
                    </View>
                </View>

                <Pressable onPress={() => onShare(post)} hitSlop={12} accessibilityLabel="Share post">
                    <Send size={22} color={MUTED} strokeWidth={2} />
                </Pressable>
            </View>
        </GlassPanel>
    );
}