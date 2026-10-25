import { CapsuleTray } from '@/components/capsule/CapsuleTray';
import { CapsuleViewer } from '@/components/capsule/CapsuleViewer';
import CommentsSheet from '@/components/comments/CommentsSheet';
import { FeedPager } from '@/components/feed/FeedPager';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { OrbitalFeedList } from '@/components/feed/OrbitalFeedList';
import Postcard from '@/components/postCard/PostCard';
import CreatePost from '@/components/createPost/CreatePost';
import ShareModal from '@/components/posts/ShareModal';
import FrostedGlass from '@/components/ui/FrostedGlass';
import OrbitLoader from '@/components/ui/OrbitLoader';
import { CAPSULE } from '@/constants/capsule/constants';
import { Rect } from '@/constants/capsule/types';
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
import { toPostcardProps, type PostcardProps } from '@/components/services/feed/postUtils';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { MenuIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { BlurTargetView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SideDrawer, { DrawerItemKey } from '../../components/sideDrawer/sideDrawer';
import { getDisplayImageUrl, resolveImg } from '../../lib/utils';
import { useDrawer } from '@/components/sideDrawer/DrawerContext';
import { GestureDetector } from 'react-native-gesture-handler';
import NotificationBell from '@/components/notifications/NotificationBell';
import { usePostViews, VIEW_COUNT_CONFIG } from '@/hooks/feed/usePostViews';

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

const HomeHeader = ({ blurTarget, topInset, onLayoutHeight, onOpenMenu, tabs, currentUser }: HeaderProps) => {
    console.log('currentUserProps', getDisplayImageUrl(currentUser?.profilePic));
    return (
        <View className="absolute inset-x-0 top-0 z-20" onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}>
            <FrostedGlass blurTarget={blurTarget} intensity={80} className="rounded-b-[28px] border-b">
                <View style={{ paddingTop: topInset }}>
                    <View className="flex-row items-center px-4 pb-3 pt-2">
                        {/* <Pressable onPress={onOpenMenu} hitSlop={8} accessibilityLabel="Open menu" className="w-9">
                        <MenuIcon color="white" size={32} />
                    </Pressable> */}
                        <Pressable
                            onPress={onOpenMenu}
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
                        </Pressable>

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
    )
}

/* ------------------------------ screen -------------------------------- */

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const blurTarget = useRef<View | null>(null);
    const pathname = usePathname();

    // data
    const currentUser = useCurrentUser();
    const feed = useHomeFeed();
    const orbitalFeed = useOrbitalFeed<PostcardProps>(toPostcardProps);
    const capsules = useCapsules();
    const share = useShare();
    const hasMoreRef = useRef(false);

    // ui state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ userId: string; origin: Rect } | null>(null);
    const [headerH, setHeaderH] = useState(insets.top + 64); // estimate until onLayout fires
    const [isFocused, setIsFocused] = useState(true);
    useFocusEffect(
        useCallback(() => {
            setIsFocused(true);
            return () => setIsFocused(false);
        }, []),
    );

    // Own visible-id per list: both lists stay mounted, so a shared one would let
    // the off-screen page steal autoplay.
    const yours = useVisibleId();
    const orbitals = useVisibleId();

    // Pan right on "Your feed" opens the drawer immediately.
    const tabs = useFeedTabs()               // no more onPanRightFromFirst
    const { open } = useDrawer()             // use open() for your hamburger button

    // tray
    const TRAY_H = CAPSULE.TRAY_ITEM_H + 24;
    const { onScroll, trayStyle } = useCollapsibleTray(TRAY_H);
    const trayFade = useAnimatedStyle(() => ({ opacity: 1 - tabs.position.get() }));
    const feedTop = headerH + TRAY_H; // Orbitals has no tray, so it only clears the header

    const currentUserProps = {
        id: currentUser?.id,
        username: currentUser?.username,
        profilePic: getDisplayImageUrl(currentUser?.profilePic),
    };

    const TAB_BAR_AREA = insets.bottom + 72; // floating tab bar height + margin; adjust to your FloatingTabBar

    const postViews = usePostViews({
        enabled:
            isFocused && !drawerOpen && !commentsPostId && !share.shareId && !viewer,
        safeTop: headerH,
        safeBottom: TAB_BAR_AREA,
    });

    const feedPairs = useRef([
        { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged: yours.onViewableItemsChanged },
        { viewabilityConfig: VIEW_COUNT_CONFIG, onViewableItemsChanged: postViews.onViewableItemsChanged },
    ]).current;

    const orbitalPairs = useRef([
        { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged: orbitals.onViewableItemsChanged },
        { viewabilityConfig: VIEW_COUNT_CONFIG, onViewableItemsChanged: postViews.onViewableItemsChanged },
    ]).current;

    const handleSelect = (key: DrawerItemKey) => {
        setDrawerOpen(false);
        if (key === 'orbitals') {
            // wait for the drawer's 240ms slide-out so the push doesn't collide with the Modal
            setTimeout(() => router.push('/orbital'), 260);
        } else if (key === 'discover') {
            setTimeout(() => router.push(`/discover/discover`), 260);
        }
    };

    const keyExtractor = useCallback((post: PostcardProps) => post.id, []);

    const renderItem = useCallback(
        ({ item }: { item: PostcardProps }) => (
            <View ref={(n) => postViews.setNode(item.id, n)} collapsable={false}>
                <Postcard
                    {...item}
                    isVisible={tabs.tab === 0 && item.id === yours.visibleId}
                    onPressComments={() => setCommentsPostId(item.id)}
                    onClickShare={share.open}
                />
            </View>
        ),
        [yours.visibleId, tabs.tab, share.open, postViews.setNode],
    );

    const renderOrbitalItem = useCallback(
        ({ item }: { item: PostcardProps }) => (
            <View ref={(n) => postViews.setNode(item.id, n)} collapsable={false}>
                <Postcard
                    {...item}
                    isVisible={tabs.tab === 1 && item.id === orbitals.visibleId}
                    onPressComments={() => setCommentsPostId(item.id)}
                    onClickShare={share.open}
                />
            </View>
        ),
        [orbitals.visibleId, tabs.tab, share.open, postViews.setNode],
    );

    const feedFooter = useMemo(
        () => (
            <View className="items-center py-6">
                {feed.loadingMore ? (
                    <ActivityIndicator color="#8a8a8a" />
                ) : !feed.hasMore && feed.posts.length > 0 ? (
                    <Text className="text-xs text-white/40">You&apos;re all caught up</Text>
                ) : null}
            </View>
        ),
        [feed.loadingMore, feed.hasMore, feed.posts.length],
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
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                extraData={`${yours.visibleId}-${tabs.tab}`}
                                showsVerticalScrollIndicator={false}
                                refreshing={feed.refreshing}
                                onRefresh={feed.refresh}
                                progressViewOffset={feedTop}
                                onScroll={onScroll}
                                scrollEventThrottle={16}
                                onEndReached={feed.loadMore}
                                onEndReachedThreshold={1.5}
                                ListFooterComponent={feedFooter}
                                initialNumToRender={3}
                                maxToRenderPerBatch={4}
                                windowSize={7}
                                viewabilityConfigCallbackPairs={feedPairs}
                                contentContainerStyle={{ paddingTop: feedTop + 12, paddingBottom: 12 }}
                                ListEmptyComponent={
                                    feed.loading ? null : <Text className="mt-8 text-center text-white/60">No posts yet.</Text>
                                }
                            />

                            {/* page 2: Orbitals (data, refresh, paging, empty states live in useOrbitalFeed) */}
                            <OrbitalFeedList
                                feed={orbitalFeed}
                                renderItem={renderOrbitalItem}
                                topInset={headerH}
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

            <HomeHeader
                blurTarget={blurTarget}
                topInset={insets.top}
                onLayoutHeight={setHeaderH}
                onOpenMenu={() => setDrawerOpen(true)}
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

            <SideDrawer
                visible={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                user={currentUser}
                onSelect={handleSelect}
                darkMode={darkMode}
                onToggleDarkMode={setDarkMode}
            />

            <OrbitLoader visible={feed.loading} />
        </View>
    );
};