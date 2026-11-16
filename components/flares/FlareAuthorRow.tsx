import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { flareTimeAgo } from './flaresUtils';
import type { FlareHandlers, FlarePost } from '@/constants/flares/types';
import { PressableScale } from './PressableScale';

type Props = {
    post: FlarePost;
    isFollowing: boolean;
    handlers: Pick<FlareHandlers, 'onFollow' | 'onMore' | 'onOpenProfile'>;
};

export function FlareAuthorRow({ post, isFollowing, handlers }: Props) {
    const { author } = post;

    return (
        <View className="flex-row items-center px-4 pt-2">
            <Pressable className="flex-1 flex-row items-center" onPress={() => handlers.onOpenProfile(post)}>
                {author.profilePic ? (
                    <Image
                        source={{ uri: author.profilePic }}
                        className="h-[50px] w-[50px] rounded-full border border-white/20 bg-white/10"
                    />
                ) : (
                    <View className="h-[50px] w-[50px] items-center justify-center rounded-full border border-white/25 bg-white/15">
                        <Text className="text-lg font-bold text-white">
                            {author.username?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                    </View>
                )}
                <View className="ml-3 flex-1">
                    <Text className="text-[17px] font-semibold text-white" numberOfLines={1}>
                        {author.username}
                    </Text>
                    <Text className="text-[14px] text-white/60" numberOfLines={1}>
                        {flareTimeAgo(post)}
                        {post.orbital?.name ? `  ·  in ${post.orbital.name}` : ''}
                    </Text>
                </View>
            </Pressable>

            {!post.isOwn && (
                <PressableScale
                    scaleTo={0.94}
                    className="mr-1"
                    onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        handlers.onFollow(author.id, isFollowing);
                    }}
                >
                    <View
                        className={`h-10 items-center justify-center rounded-full border px-5 ${isFollowing ? 'border-white/25 bg-transparent' : 'border-white/10 bg-white/10'
                            }`}
                    >
                        <Text className={`text-[16px] font-semibold ${isFollowing ? 'text-white/70' : 'text-white'}`}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </View>
                </PressableScale>
            )}

            <PressableScale onPress={() => handlers.onMore(post)} className="ml-3 p-1" accessibilityLabel="More options">
                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </PressableScale>
        </View>
    );
}