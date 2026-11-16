import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { splitCaption } from './flaresUtils';
import type { FlarePost } from '@/constants/flares/types';

const LONG = 90;

type Props = { post: FlarePost; onHashtag: (tag: string) => void };

export function FlareCaption({ post, onHashtag }: Props) {
    const [expanded, setExpanded] = useState(false);
    const { caption, tags } = splitCaption(post);
    const isLong = caption.length > LONG || caption.split('\n').length > 2;

    const toggle = () => {
        try { LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')); } catch { /* noop */ }
        setExpanded((v) => !v);
    };

    return (
        <View>
            {!!caption && (
                <Pressable onPress={isLong ? toggle : undefined}>
                    <Text className="text-[18px] font-semibold text-white" numberOfLines={expanded ? undefined : 2}>
                        {caption}
                    </Text>
                    {isLong && !expanded && <Text className="mt-0.5 text-[14px] font-semibold text-white/55">more</Text>}
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