import { ShareHoldButton } from '@/components/postCard/ShareQuick';
import { formatCount } from '@/components/services/feed/postUtils';
import { LIKE_COLOR, SAVED_COLOR } from '@/constants/flares/contants';
import type { usePostActions } from '@/hooks/feed/usePostActions';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';

type Actions = ReturnType<typeof usePostActions>;

type Props = {
    postId: string;
    actions: Actions;
    onComment: (id: string) => void;
    onShare: (id: string) => void;
};

export function FlareActions({ postId, actions, onComment, onShare }: Props) {
    const { liked, likeCount, saved, commentsCount, like, toggleSave } = actions;
    const pop = useRef(new Animated.Value(1)).current;
    const wasLiked = useRef(liked);

    useEffect(() => {
        if (liked && !wasLiked.current) {
            Animated.sequence([
                Animated.spring(pop, { toValue: 1.35, useNativeDriver: true, damping: 6, stiffness: 400, mass: 0.5 }),
                Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 260, mass: 0.6 }),
            ]).start();
        }
        wasLiked.current = liked;
    }, [liked, pop]);

    return (
        <View className="mt-4 flex-row items-center justify-center">
            <View className="h-[46px] flex-row items-center rounded-full border border-white/10 bg-black/55 px-6">
                <PressableScale
                    onPress={() => {
                        if (!liked && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        like(false);
                    }}
                    accessibilityLabel={liked ? 'Unlike' : 'Like'}
                >
                    <View className="flex-row items-center">
                        <Animated.View style={{ transform: [{ scale: pop }] }}>
                            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? LIKE_COLOR : '#fff'} />
                        </Animated.View>
                        <Text className="ml-2 text-[15px] font-medium text-white">{formatCount(likeCount)}</Text>
                    </View>
                </PressableScale>

                <PressableScale className="ml-6" onPress={() => onComment(postId)} accessibilityLabel="Open comments">
                    <View className="flex-row items-center">
                        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
                        <Text className="ml-2 text-[15px] font-medium text-white">{commentsCount}</Text>
                    </View>
                </PressableScale>

                <PressableScale className="ml-6" onPress={toggleSave} accessibilityLabel={saved ? 'Unsave' : 'Save'}>
                    <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={saved ? SAVED_COLOR : '#fff'} />
                </PressableScale>
            </View>

            {/* tap = share sheet, hold + drag = quick share to a friend */}
            <View className="absolute right-0">
                <ShareHoldButton
                    postId={postId}
                    onPress={() => onShare(postId)}
                    accessibilityLabel="Share"
                    className="h-[46px] w-[46px] items-center justify-center rounded-full border border-white/10 bg-black/55"
                >
                    <Ionicons name="paper-plane-outline" size={22} color="#fff" />
                </ShareHoldButton>
            </View>
        </View>
    );
}