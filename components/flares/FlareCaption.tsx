import type { FlarePost } from '@/constants/flares/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { splitCaption } from './flaresUtils';

const LONG = 90;

export const isLongCaption = (post: FlarePost) => {
    const { caption } = splitCaption(post);
    return caption.length > LONG || caption.split('\n').length > 2;
};

export const animateCaption = () => {
    try { LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); } catch { /* noop */ }
};

type Props = {
    post: FlarePost;
    onHashtag: (tag: string) => void;
    expanded: boolean;
    onToggle: () => void;
};

export function FlareCaption({ post, onHashtag, expanded, onToggle }: Props) {
    const { caption, tags } = splitCaption(post);
    const isLong = isLongCaption(post);

    return (
        <View>
            {!!caption && (
                <Pressable onPress={isLong ? onToggle : undefined} hitSlop={8}>
                    <Text className="text-[18px] font-semibold text-white" numberOfLines={expanded ? 16 : 2}>
                        {caption}
                    </Text>
                    {isLong && (
                        <View className="mt-1 flex-row items-center self-start">
                            <Text className="text-[14px] font-semibold text-white/60">{expanded ? 'less' : 'more'}</Text>
                            <Ionicons
                                name={expanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="rgba(255,255,255,0.6)"
                                style={{ marginLeft: 2 }}
                            />
                        </View>
                    )}
                </Pressable>
            )}

            {tags.length > 0 && (
                <View className="mt-1.5 flex-row flex-wrap">
                    {tags.map((t) => (
                        <Pressable key={t} onPress={() => onHashtag(t)} hitSlop={6}>
                            <Text className="mr-3 text-[15px] text-white/55">#{t}</Text>
                        </Pressable>
                    ))}
                </View>
            )}

            {post.music?.title ? (
                <PressableScale scaleTo={0.97} className="mt-3 self-start">
                    <View className="flex-row items-center">
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
                            <Ionicons name="musical-notes-outline" size={20} color="#fff" />
                        </View>
                        <Text className="ml-3 text-[15px] text-white/90">{post.music.title}</Text>
                    </View>
                </PressableScale>
            ) : null}
        </View>
    );
}