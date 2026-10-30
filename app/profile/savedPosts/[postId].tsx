import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/redux/store';
import { fetchSavedPosts, selectSavedById, selectSavedStatus, unsavePost } from '@/redux/slice/savedPostsSlice';
import { useSharedPost } from '@/components/services/chat/sharedPost';
import type { PostcardProps } from '@/components/services/feed/postUtils';
import Postcard from '@/components/postCard/PostCard';
import CommentsSheet from '@/components/comments/CommentsSheet';
import ShareModal from '@/components/posts/ShareModal';
import OrbitLoader from '@/components/ui/OrbitLoader';
import { useCurrentUser, useShare } from '@/hooks/feed/useHomeFeed';
import { AmbientBackground, GlassHeader, HEADER_H, StateView } from '@/components/savedPosts/SavedUI';

const timeAgo = (iso: string) => {
    const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `${Math.floor(s / 60) || 1}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PostDetailScreen() {
    const { postId, from, comments } = useLocalSearchParams<{ postId: string; from?: string; comments?: string }>();
    const dispatch = useDispatch<AppDispatch>();
    const insets = useSafeAreaInsets();

    const saved = useSelector(selectSavedById(postId));
    const status = useSelector(selectSavedStatus);
    const uid = useSelector((s: RootState) => (s as any).profile?.userId ?? null) as string | null;
    const hadSaved = useRef(false);

    const currentUser = useCurrentUser();
    const share = useShare();
    const [commentsOpen, setCommentsOpen] = useState(comments === '1');
    const [extraComments, setExtraComments] = useState(0);

    const { post: shared, failed } = useSharedPost(postId, undefined, !saved);

    useEffect(() => {
        if (status === 'idle') dispatch(fetchSavedPosts());
    }, [status, dispatch]);

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
                    isLikedByCurrentUser: shared.isLikedByCurrentUser ?? (!!uid && !!shared.likedBy?.includes(uid)),
                    isSaved: false,
                    orbital: shared.orbital,
                } as unknown as PostcardProps)
                : null,
        [shared, uid],
    );

    const baseCard = (saved?.card as PostcardProps | undefined) ?? sharedCard;
    const card = baseCard ? { ...baseCard, commentsCount: Math.max(0, baseCard.commentsCount + extraComments) } : null;

    const unsave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(unsavePost(postId));
    };

    const currentUserProps = {
        id: currentUser?.id,
        username: currentUser?.username,
        profilePic: currentUser?.profilePic,
    };

    return (
        <View className="flex-1 bg-[#07070A]">
            {/* from a notification the expanding card is already covering the screen: plain fade */}
            <Stack.Screen
                options={{ headerShown: false, animation: from === 'notif' ? 'fade' : 'fade_from_bottom' }}
            />
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
                                <Text className="ml-1.5 text-[12px] font-medium text-white/60">Saved {timeAgo(saved.savedAt)}</Text>
                            </View>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInDown.delay(60).springify().damping(20)}>
                        <Postcard
                            {...card}
                            isVisible
                            onPressComments={() => setCommentsOpen(true)}
                            onClickShare={share.open}
                        />
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
            ) : null}

            <CommentsSheet
                visible={commentsOpen}
                postId={postId}
                onClose={() => setCommentsOpen(false)}
                currentUser={currentUserProps}
                onCountChange={(_id: string, delta: number) => setExtraComments((n) => n + delta)}
            />
            <ShareModal
                visible={share.shareId !== null}
                postId={share.shareId}
                friends={share.friends}
                orbitals={share.orbitals}
                onClose={share.close}
            />

            <OrbitLoader visible={!card && !failed} />
        </View>
    );
}