import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/redux/store';
import {
    fetchSavedPosts,
    selectSavedById,
    selectSavedStatus,
    unsavePost,
} from '@/redux/slice/savedPostsSlice';
import { useSharedPost } from '@/components/services/chat/sharedPost';
import type { PostcardProps } from '@/components/services/feed/postUtils';
import Postcard from '@/components/postCard/PostCard'; // ← keep the import path you already use
import { AmbientBackground, GlassHeader, HEADER_H, StateView } from '@/components/savedPosts/SavedUI';

const timeAgo = (iso: string) => {
    const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `${Math.floor(s / 60) || 1}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Single-post screen. Opened from the saved grid (post comes from redux)
 * and from shared posts in chat (post is fetched by id when it isn't saved).
 */
export default function PostDetailScreen() {
    const { postId } = useLocalSearchParams<{ postId: string }>();
    const dispatch = useDispatch<AppDispatch>();
    const insets = useSafeAreaInsets();

    const saved = useSelector(selectSavedById(postId));
    const status = useSelector(selectSavedStatus);
    const uid = useSelector((s: RootState) => (s as any).profile?.userId ?? null) as string | null; // ← adjust if needed
    const hadSaved = useRef(false);

    // Only hits the network when the post isn't already in the saved store.
    const { post: shared, failed } = useSharedPost(postId, undefined, !saved);

    // Know which posts are saved (for the chip + bookmark) even when opened from chat.
    useEffect(() => {
        if (status === 'idle') dispatch(fetchSavedPosts());
    }, [status, dispatch]);

    // If a saved post gets unsaved while viewing it, leave smoothly.
    useEffect(() => {
        if (saved) hadSaved.current = true;
        else if (hadSaved.current) router.back();
    }, [saved]);

    const sharedCard = useMemo(
        () =>
            shared
                ? ({
                    id: shared.id,
                    author: shared.author ?? { username: 'Unknown' },
                    createdAt: shared.createdAt ?? new Date().toISOString(),
                    content: shared.content ?? '',
                    image: shared.image,
                    video: shared.video,
                    voiceNote: shared.voiceNote,
                    voiceNoteDuration: shared.voiceNoteDuration,
                    mediaWidth: shared.mediaWidth,
                    mediaHeight: shared.mediaHeight,
                    likesCount: shared.likesCount ?? 0,
                    commentsCount: shared.commentsCount ?? 0,
                    isLikedByCurrentUser:
                        shared.isLikedByCurrentUser ?? (!!uid && !!shared.likedBy?.includes(uid)),
                    isSaved: false,
                    orbital: shared.orbital,
                } as unknown as PostcardProps)
                : null,
        [shared, uid],
    );

    const card = (saved?.card as PostcardProps | undefined) ?? sharedCard;

    const unsave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(unsavePost(postId));
    };

    return (
        <View className="flex-1 bg-[#07070A]">
            <Stack.Screen options={{ headerShown: false, animation: 'fade_from_bottom' }} />
            <AmbientBackground />
            <GlassHeader
                title="Post"
                alwaysVisible
                right={
                    saved ? (
                        <Pressable
                            hitSlop={8}
                            onPress={unsave}
                            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:bg-white/10"
                        >
                            <Ionicons name="bookmark" size={18} color="#fff" />
                        </Pressable>
                    ) : undefined
                }
            />

            {card ? (
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingTop: insets.top + HEADER_H + 12,
                        paddingBottom: insets.bottom + 48,
                    }}
                >
                    {saved && (
                        <Animated.View entering={FadeIn.duration(300)} className="mb-3 px-4">
                            <View className="self-start flex-row items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                                <Ionicons name="bookmark" size={11} color="rgba(255,255,255,0.7)" />
                                <Text className="ml-1.5 text-[12px] font-medium text-white/60">
                                    Saved {timeAgo(saved.savedAt)}
                                </Text>
                            </View>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInDown.delay(60).springify().damping(20)}>
                        <Postcard {...card} isVisible />
                    </Animated.View>
                </Animated.ScrollView>
            ) : failed ? (
                <View style={{ paddingTop: insets.top + HEADER_H }}>
                    <StateView
                        icon="alert-circle-outline"
                        title="Post unavailable"
                        message="It may have been deleted, or you may not have access to it."
                    />
                </View>
            ) : (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#fff" />
                </View>
            )}
        </View>
    );
}
