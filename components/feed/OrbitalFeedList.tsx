import type { OrbitalFeed } from '@/hooks/feed/useOrbitalFeed';
import { FeedFooter } from '@/components/feed/FeedFooter';
import { ComponentProps, useCallback, useEffect } from 'react';
import { ListRenderItem, Pressable, Text, View } from 'react-native';
import Reanimated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

type ListProps = ComponentProps<typeof Reanimated.FlatList>;
type OrbitalPost = { id: string; orbital?: { name?: string } };

const keyExtractor = (post: OrbitalPost) => post.id;

/* ---------- empty / loading / error states ---------- */

function PostSkeleton() {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.set(withRepeat(withTiming(0.5, { duration: 900 }), -1, true));
    }, [opacity]);
    const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

    return (
        <Reanimated.View style={pulse}>
            <View className="mx-3 mb-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 rounded-full bg-white/10" />
                    <View className="gap-2">
                        <View className="h-3 w-28 rounded-full bg-white/10" />
                        <View className="h-2.5 w-20 rounded-full bg-white/5" />
                    </View>
                </View>
                <View className="mt-4 h-48 rounded-2xl bg-white/5" />
            </View>
        </Reanimated.View>
    );
}

type MessageProps = { title: string; subtitle: string; action: string; onPress: () => void };

function Message({ title, subtitle, action, onPress }: MessageProps) {
    return (
        <View className="mx-3 mt-6 items-center rounded-3xl border border-white/10 bg-white/5 px-6 py-10">
            <Text className="text-center text-base font-semibold text-white/90">{title}</Text>
            <Text className="mt-1.5 text-center text-sm text-white/50">{subtitle}</Text>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                className="mt-5 rounded-full border border-white/10 bg-[#0c0c0c] px-5 py-2.5 active:scale-95"
            >
                <Text className="text-sm font-semibold text-white/90">{action}</Text>
            </Pressable>
        </View>
    );
}

type EmptyProps = { loading: boolean; error: string | null; onRetry: () => void; onBrowse: () => void };

function FeedEmpty({ loading, error, onRetry, onBrowse }: EmptyProps) {
    if (loading) {
        return (
            <>
                {[0, 1, 2].map((i) => (
                    <PostSkeleton key={i} />
                ))}
            </>
        );
    }
    if (error) {
        return <Message title="Couldn't load orbital posts" subtitle={error} action="Try again" onPress={onRetry} />;
    }
    return (
        <Message
            title="Nothing here yet"
            subtitle="Posts from the orbitals you've joined will show up here."
            action="Browse orbitals"
            onPress={onBrowse}
        />
    );
}

/* ---------- list ---------- */

type Props<T extends OrbitalPost> = {
    feed: OrbitalFeed<T>;
    /** The same renderItem you use for the main feed. */
    renderItem: ListRenderItem<T>;
    /** Props shared with the main feed list (scroll handler, viewability pairs, extraData...). */
    listProps: Partial<ListProps>;
    /** header height: content starts below it */
    topInset: number;
    /** floating tab bar height (+ safe area): the footer loader sits just above it */
    bottomInset: number;
    onBrowse: () => void;
};

export function OrbitalFeedList<T extends OrbitalPost>({
    feed,
    renderItem,
    listProps,
    topInset,
    bottomInset,
    onBrowse,
}: Props<T>) {
    // each post shows which orbital it came from
    const renderWithOrbital: ListRenderItem<T> = useCallback(
        (info) => (
            <View>
                {info.item.orbital?.name ? (
                    <View className="mx-4 mb-1.5 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        <Text className="text-xs font-medium text-white/60">{info.item.orbital.name}</Text>
                    </View>
                ) : null}
                {renderItem(info)}
            </View>
        ),
        [renderItem],
    );

    return (
        <Reanimated.FlatList
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={7}
            {...listProps}
            data={feed.posts}
            keyExtractor={keyExtractor}
            renderItem={renderWithOrbital}
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            progressViewOffset={topInset}
            contentContainerStyle={{ paddingTop: topInset + 12 }}
            onEndReached={feed.hasMore ? feed.loadMore : undefined}
            onEndReachedThreshold={1.5}
            ListEmptyComponent={
                <FeedEmpty loading={feed.loading} error={feed.error} onRetry={feed.retry} onBrowse={onBrowse} />
            }
            ListFooterComponent={
                feed.posts.length === 0 ? null : (
                    <FeedFooter
                        loading={feed.loadingMore}
                        hasMore={feed.hasMore}
                        hasItems
                        bottomInset={bottomInset}
                    />
                )
            }
        />
    );
}