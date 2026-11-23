import { CapsuleTray } from '@/components/capsule/CapsuleTray';
import { CapsuleViewer } from '@/components/capsule/CapsuleViewer';
import CommentsSheet from '@/components/comments/CommentsSheet';
import CreatePost from '@/components/createPost/CreatePost';
import { FeedFooter } from '@/components/feed/FeedFooter';
import { FeedPager } from '@/components/feed/FeedPager';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { OrbitalFeedList } from '@/components/feed/OrbitalFeedList';
import { FlarePullLoader } from '@/components/flares/FlarePullLoader';
import { isFlareEligible } from '@/components/flares/flaresUtils';
import NotificationBell from '@/components/notifications/NotificationBell';
import Postcard from '@/components/postCard/PostCard';
import ShareModal from '@/components/posts/ShareModal';
import { toPostcardProps, type PostcardProps } from '@/components/services/feed/postUtils';
import { useDrawer } from '@/components/sideDrawer/DrawerContext';
import FrostedGlass from '@/components/ui/FrostedGlass';
import { CAPSULE } from '@/constants/capsule/constants';
import { Rect } from '@/constants/capsule/types';
import type { FlarePost } from '@/constants/flares/types';
import { useCapsules } from '@/hooks/capsule/useCapsules';
import { useCollapsibleTray } from '@/hooks/capsule/useCollapsibleTray';
import { useFeedTabs } from '@/hooks/feed/useFeedTabs';
import {
    useCurrentUser,
    useHomeFeed,
    useShare,
    useVisibleId,
    VIEWABILITY_CONFIG,
} from '@/hooks/feed/useHomeFeed';
import { useOrbitalFeed } from '@/hooks/feed/useOrbitalFeed';
import { usePostViews, VIEW_COUNT_CONFIG } from '@/hooks/feed/usePostViews';
import { setFlareSeed } from '@/hooks/flares/flareSeed';
import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayImageUrl } from '../../lib/utils';
import { openAccountSwitcher } from '@/components/auth/AccountSwitcher';
import AccountSwipeAvatar from '@/components/auth/AccountSwipeAvatar';

/** Floating tab bar height (without the safe-area inset). Adjust to match your bar. */
const TAB_BAR_H = 80;

/* ------------------------------ header -------------------------------- */

type HeaderProps = {
    blurTarget: React.RefObject<View | null>;
    topInset: number;
    onLayoutHeight: (h: number) => void;
    onOpenMenu: () => void;
    tabs: ReturnType<typeof useFeedTabs>;
    currentUser?: {
        profilePic?: string;
    };
};

const HomeHeader = ({ blurTarget, topInset, onLayoutHeight, onOpenMenu, tabs, currentUser }: HeaderProps) => (
    <View className="absolute inset-x-0 top-0 z-20" onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}>
        <FrostedGlass blurTarget={blurTarget} intensity={80} className="rounded-b-[28px] border-b">
            <View style={{ paddingTop: topInset }}>
                <View className="flex-row items-center px-4 pb-3 pt-2">
                    <AccountSwipeAvatar
                        onPress={onOpenMenu}
                        onLongPress={openAccountSwitcher} delayLongPress={350}
                        accessibilityLabel="Open profile"
                        className="w-10 h-10 rounded-full overflow-hidden"
                    >
                        {currentUser?.profilePic ? (
                            <Image
                                source={{ uri: getDisplayImageUrl(currentUser.profilePic) }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full bg-gray-500" />
                        )}
                    </AccountSwipeAvatar>

                    <View className="flex-1 py-2">
                        <Text
                            className="text-center text-2xl font-bold tracking-widest text-white/90"
                            style={{
                                textShadowColor: 'rgba(255,255,255,0.45)',
                                textShadowOffset: { width: 0, height: 0 },
                                textShadowRadius: 12,
                            }}
                        >
                            Orbit
                        </Text>
                    </View>

                    <View className="w-9" />
                    <NotificationBell />
                </View>

                <View className="items-center px-4 pb-3">
                    <FeedTabs position={tabs.position} active={tabs.tab} onSelect={tabs.goTo} />
                </View>
            </View>
        </FrostedGlass>
    </View>
);

/* ------------------------------ screen -------------------------------- */

type FlareSource = 'feed' | 'orbital';

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const blurTarget = useRef<View | null>(null);
    const focused = useIsFocused();
    const tabBarInset = TAB_BAR_H + insets.bottom;

    // data
    const currentUser = useCurrentUser();
    const feed = useHomeFeed();
    const orbitalFeed = useOrbitalFeed<PostcardProps>(toPostcardProps);
    const capsules = useCapsules();
    const share = useShare();
    const tabs = useFeedTabs();
    const { open } = useDrawer();
    const homePullOffset = useSharedValue(0);
    const wasHomeRefreshing = useRef(false);

    useEffect(() => {
        if (wasHomeRefreshing.current && !feed.refreshing) homePullOffset.value = 0;
        wasHomeRefreshing.current = feed.refreshing;
    }, [feed.refreshing, homePullOffset]);

    // tapping the Home tab while already on it: scroll to the top and reload the feed
    const navigation = useNavigation();
    const yourListRef = useRef<any>(null);
    const onTabPressRef = useRef<() => void>(() => { });
    onTabPressRef.current = () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        if (tabs.tab === 0) {
            yourListRef.current?.scrollToOffset({ offset: 0, animated: true });
            feed.refresh();
        } else {
            (orbitalFeed as any).refresh?.();
        }
    };
    useEffect(() => {
        const unsubscribe = (navigation as any).addListener('tabPress', () => {
            if (navigation.isFocused()) onTabPressRef.current();
        });
        return unsubscribe;
    }, [navigation]);

    // ui state
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ userId: string; origin: Rect } | null>(null);
    const [headerH, setHeaderH] = useState(insets.top + 64); // estimate until onLayout fires

    // Own visible-id per list: both lists stay mounted, so a shared one would let
    // the off-screen page steal autoplay.
    const yours = useVisibleId();
    const orbitals = useVisibleId();

    // ---- open a post as a flare ----
    // Home only navigates: the flare page runs its own (ranked flares) feed, starting at this post.
    // Refs keep openFlare stable, so Postcard's memo isn't broken by every feed update.
    const feedPostsRef = useRef(feed.posts);
    feedPostsRef.current = feed.posts;
    const orbitalPostsRef = useRef((orbitalFeed as any).posts as PostcardProps[] | undefined);
    orbitalPostsRef.current = (orbitalFeed as any).posts;

    const openFlare = useCallback(
        (source: FlareSource, id: string) => {
            const list = ((source === 'feed' ? feedPostsRef.current : orbitalPostsRef.current) ?? []) as FlarePost[];
            const post = list.find((p) => p.id === id);
            if (!post || !isFlareEligible(post)) return;
            setFlareSeed(post);
            router.push({ pathname: '/flare/[id]', params: { id } });
        },
        [router],
    );
    const openFeedFlare = useCallback((id: string) => openFlare('feed', id), [openFlare]);
    const openOrbitalFlare = useCallback((id: string) => openFlare('orbital', id), [openFlare]);

    // View counting: a post counts after 1s of being fully on screen. Paused while
    // another tab/screen/sheet is on top (`focused` goes false when the flare page opens),
    // so it never counts something the user can't see.
    const overlayOpen = commentsPostId !== null || share.shareId !== null || !!viewer;
    const yourViews = usePostViews({
        enabled: focused && !overlayOpen && tabs.tab === 0,
        safeTop: headerH,
        safeBottom: tabBarInset,
    });
    const orbitalViews = usePostViews({
        enabled: focused && !overlayOpen && tabs.tab === 1,
        safeTop: headerH,
        safeBottom: tabBarInset,
    });

    // FlatList needs these pairs to be stable, so they are created once.
    const yourPairs = useRef([
        { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged: yours.onViewableItemsChanged },
        { viewabilityConfig: VIEW_COUNT_CONFIG, onViewableItemsChanged: yourViews.onViewableItemsChanged },
    ]).current;
    const orbitalPairs = useRef([
        { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged: orbitals.onViewableItemsChanged },
        { viewabilityConfig: VIEW_COUNT_CONFIG, onViewableItemsChanged: orbitalViews.onViewableItemsChanged },
    ]).current;

    // tray
    const TRAY_H = CAPSULE.TRAY_ITEM_H + 24;
    const { onScroll, trayStyle } = useCollapsibleTray(TRAY_H, undefined, homePullOffset);
    const trayFade = useAnimatedStyle(() => ({ opacity: 1 - tabs.position.get() }));
    const feedTop = headerH + TRAY_H; // Orbitals has no tray, so it only clears the header

    const currentUserProps = {
        id: currentUser?.id,
        username: currentUser?.username,
        profilePic: getDisplayImageUrl(currentUser?.profilePic),
    };

    const keyExtractor = useCallback((post: PostcardProps) => post.id, []);

    const yourSetNode = yourViews.setNode;
    const renderItem = useCallback(
        ({ item }: { item: PostcardProps }) => (
            <View ref={(n) => yourSetNode(item.id, n)} collapsable={false}>
                <Postcard
                    {...item}
                    isVisible={tabs.tab === 0}
                    onPressComments={() => setCommentsPostId(item.id)}
                    onClickShare={share.open}
                    onOpenFlare={openFeedFlare}
                />
            </View>
        ),
        [tabs.tab, share.open, yourSetNode, openFeedFlare],
    );

    const orbitalSetNode = orbitalViews.setNode;
    const renderOrbitalItem = useCallback(
        ({ item }: { item: PostcardProps }) => (
            <View ref={(n) => orbitalSetNode(item.id, n)} collapsable={false}>
                <Postcard
                    {...item}
                    isVisible={tabs.tab === 1}
                    onPressComments={() => setCommentsPostId(item.id)}
                    onClickShare={share.open}
                    onOpenFlare={openOrbitalFlare}
                />
            </View>
        ),
        [tabs.tab, share.open, orbitalSetNode, openOrbitalFlare],
    );

    return (
        <View className="flex-1 bg-black">
            {/* Everything behind the glass. Must come BEFORE the BlurViews in the tree. */}
            <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
                <GestureDetector gesture={tabs.gesture}>
                    <View style={{ flex: 1 }}>
                        <FeedPager position={tabs.position}>
                            {/* page 1: Your feed */}
                            <Reanimated.FlatList
                                data={feed.posts}
                                ref={yourListRef}
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                viewabilityConfigCallbackPairs={yourPairs}
                                extraData={`${yours.visibleId}-${tabs.tab}`}
                                showsVerticalScrollIndicator={false}
                                refreshing={feed.refreshing}
                                onRefresh={feed.refresh}
                                progressViewOffset={feedTop}
                                onScroll={onScroll}
                                scrollEventThrottle={16}
                                contentContainerStyle={{ paddingTop: feedTop + 12 }}
                                ListEmptyComponent={
                                    feed.loading ? null : <Text className="mt-8 text-center text-white/60">No posts yet.</Text>
                                }
                                ListFooterComponent={
                                    <FeedFooter
                                        loading={feed.loadingMore}
                                        hasMore={feed.hasMore}
                                        hasItems={feed.posts.length > 0}
                                        bottomInset={tabBarInset}
                                    />
                                }
                                onEndReached={() => {
                                    if (!feed.loading && !feed.loadingMore && feed.hasMore) feed.loadMore();
                                }}
                                onEndReachedThreshold={1}
                            />

                            {/* page 2: Orbitals (data, refresh, paging, empty states live in useOrbitalFeed) */}
                            <OrbitalFeedList
                                feed={orbitalFeed}
                                renderItem={renderOrbitalItem}
                                topInset={headerH}
                                bottomInset={tabBarInset}
                                onBrowse={() => router.push('/orbital')}
                                listProps={{
                                    viewabilityConfigCallbackPairs: orbitalPairs,
                                    extraData: `${orbitals.visibleId}-${tabs.tab}`,
                                    showsVerticalScrollIndicator: false,
                                    onScroll,
                                    scrollEventThrottle: 16,
                                }}
                            />
                        </FeedPager>
                    </View>
                </GestureDetector>
            </BlurTargetView>

            {/* Capsule tray: under the header, slides up behind it on scroll */}
            <Reanimated.View
                pointerEvents="box-none"
                style={[{ position: 'absolute', left: 0, right: 0, top: headerH, height: TRAY_H, zIndex: 10 }, trayStyle]}
            >
                <Reanimated.View style={[{ flex: 1 }, trayFade]} pointerEvents={tabs.tab === 1 ? 'none' : 'box-none'}>
                    <View className="flex-1 px-3">
                        <FrostedGlass blurTarget={blurTarget} className="flex-1 rounded-3xl border pt-3">
                            <CapsuleTray
                                groups={capsules.groups}
                                currentUserId={capsules.me?.id}
                                onAdd={() => router.push('/capsule/create')}
                                onOpen={(userId, origin) => setViewer({ userId, origin })}
                            />
                        </FrostedGlass>
                    </View>
                </Reanimated.View>
            </Reanimated.View>

            {tabs.tab === 0 && (
                <FlarePullLoader
                    offset={homePullOffset}
                    busy={feed.refreshing}
                    threshold={78}
                    hold={58}
                    top={headerH + 6}
                />
            )}

            <HomeHeader
                blurTarget={blurTarget}
                topInset={insets.top}
                onLayoutHeight={setHeaderH}
                onOpenMenu={open}
                tabs={tabs}
                currentUser={currentUserProps}
            />

            <CreatePost
                user={currentUserProps}
                onPostCreated={(_post, target) => {
                    if (target === 'feed') feed.refresh();
                }}
            />

            {/* overlays: siblings, no layout space */}
            <CommentsSheet
                visible={commentsPostId !== null}
                postId={commentsPostId}
                onClose={() => setCommentsPostId(null)}
                currentUser={currentUserProps}
                onCountChange={feed.bumpComments}
            />

            <ShareModal
                visible={share.shareId !== null}
                postId={share.shareId}
                friends={share.friends}
                orbitals={share.orbitals}
                onClose={share.close}
            />

            <CapsuleViewer
                visible={!!viewer && !!capsules.me}
                groups={capsules.groups}
                startUserId={viewer?.userId ?? ''}
                origin={viewer?.origin ?? null}
                currentUserId={capsules.me?.id ?? ''}
                onClose={() => setViewer(null)}
                onViewed={capsules.markSeen}
                onToggleLike={capsules.toggleLike}
                onToggleSave={capsules.toggleSave}
                onDelete={capsules.remove}
                onCommentAdded={capsules.bumpComments}
            />
        </View>
    );
}