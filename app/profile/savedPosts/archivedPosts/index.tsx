import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchArchivedPosts,
    selectArchivedError,
    selectArchivedIds,
    selectArchivedStatus,
} from '@/redux/slice/archivedPosts/archivedPostsSlice';
import ArchivedPostTile, { GRID } from '@/components/archivedPosts/ArchivedPostsTile';
import {
    AmbientBackground,
    GlassHeader,
    GridSkeleton,
    HEADER_H,
    StateView,
} from '@/components/savedPosts/SavedUI';
import { AppDispatch } from '@/redux/store';

export default function ArchivedPostsScreen() {
    const dispatch = useDispatch<AppDispatch>();
    const insets = useSafeAreaInsets();
    const ids = useSelector(selectArchivedIds);
    const status = useSelector(selectArchivedStatus);
    const error = useSelector(selectArchivedError);
    const [refreshing, setRefreshing] = useState(false);

    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });

    useEffect(() => {
        dispatch(fetchArchivedPosts());
    }, [dispatch]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await dispatch(fetchArchivedPosts());
        setRefreshing(false);
    }, [dispatch]);

    const renderItem = useCallback(
        ({ item, index }: { item: string; index: number }) => <ArchivedPostTile id={item} index={index} />,
        [],
    );

    const loading = status === 'loading' && ids.length === 0;
    const failed = status === 'failed' && ids.length === 0;
    const empty = status === 'succeeded' && ids.length === 0;

    return (
        <View className="flex-1 bg-[#07070A]">
            <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
            <AmbientBackground />
            <GlassHeader title="Archived" scrollY={scrollY} />

            <Animated.FlatList
                data={ids}
                keyExtractor={(id) => id}
                renderItem={renderItem}
                numColumns={GRID.COLUMNS}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={7}
                columnWrapperStyle={{ gap: GRID.GAP, paddingHorizontal: GRID.PAD }}
                ItemSeparatorComponent={() => <View style={{ height: GRID.GAP }} />}
                contentContainerStyle={{
                    paddingTop: insets.top + HEADER_H,
                    paddingBottom: insets.bottom + 40,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#ffffff"
                        progressViewOffset={insets.top + HEADER_H}
                    />
                }
                ListHeaderComponent={
                    <View className="px-5 pb-6 pt-2">
                        <Text className="text-[36px] font-bold tracking-tight text-white">Archived</Text>
                        <Text className="mt-1 text-[14px] text-white/45">
                            {ids.length > 0
                                ? `${ids.length} ${ids.length === 1 ? 'post' : 'posts'}, visible only to you`
                                : 'Posts you archive show up here'}
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    loading ? (
                        <GridSkeleton />
                    ) : failed ? (
                        <StateView
                            icon="cloud-offline-outline"
                            title="Couldn't load archived posts"
                            message={error ?? 'Check your connection and try again.'}
                            action="Try again"
                            onAction={refresh}
                        />
                    ) : empty ? (
                        <StateView
                            icon="archive-outline"
                            title="Nothing archived"
                            message="Open the ... menu on one of your posts and choose Archive to hide it from your profile."
                        />
                    ) : null
                }
            />
        </View>
    );
}