import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@/redux/store';
import {
    fetchArchivedPosts,
    selectArchivedById,
    selectArchivedStatus,
    unarchivePost,
} from '@/redux/slice/archivedPosts/archivedPostsSlice';
import type { PostcardProps } from '@/components/services/feed/postUtils';
import Postcard from '@/components/postCard/PostCard';
import { AmbientBackground, GlassHeader, HEADER_H, StateView } from '@/components/savedPosts/SavedUI';

/** One archived post, opened from the archived grid. Same layout as the saved post screen. */
export default function ArchivedPostScreen() {
    const { postId } = useLocalSearchParams<{ postId: string }>();
    const dispatch = useDispatch<AppDispatch>();
    const insets = useSafeAreaInsets();
    const item = useSelector(selectArchivedById(postId));
    const status = useSelector(selectArchivedStatus);
    const hadItem = useRef(false);

    // opened without the grid first (deep link): load the list
    useEffect(() => {
        if (status === 'idle') dispatch(fetchArchivedPosts());
    }, [status, dispatch]);

    // once unarchived, leave smoothly
    useEffect(() => {
        if (item) hadItem.current = true;
        else if (hadItem.current) router.back();
    }, [item]);

    const unarchive = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(unarchivePost(postId));
    };

    const card = item?.card as PostcardProps | undefined;

    return (
        <View className="flex-1 bg-[#07070A]">
            <Stack.Screen options={{ headerShown: false, animation: 'fade_from_bottom' }} />
            <AmbientBackground />
            <GlassHeader
                title="Archived post"
                alwaysVisible
                right={
                    item ? (
                        <Pressable
                            hitSlop={8}
                            onPress={unarchive}
                            accessibilityLabel="Unarchive post"
                            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:bg-white/10"
                        >
                            <Ionicons name="arrow-undo-outline" size={18} color="#fff" />
                        </Pressable>
                    ) : undefined
                }
            />

            {card ? (
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingTop: insets.top + HEADER_H + 12, paddingBottom: insets.bottom + 48 }}
                >
                    <Animated.View entering={FadeIn.duration(300)} className="mb-3 px-4">
                        <View className="self-start flex-row items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                            <Ionicons name="archive-outline" size={11} color="rgba(255,255,255,0.7)" />
                            <Text className="ml-1.5 text-[12px] font-medium text-white/60">Archived, only you can see this</Text>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(60).springify().damping(20)}>
                        <Postcard {...card} />
                    </Animated.View>
                </Animated.ScrollView>
            ) : status === 'failed' ? (
                <View style={{ paddingTop: insets.top + HEADER_H }}>
                    <StateView icon="alert-circle-outline" title="Post unavailable" message="It may have been deleted or unarchived." />
                </View>
            ) : (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#fff" />
                </View>
            )}
        </View>
    );
}