import { VideoViewer } from '@/components/chats/MediaBubble'
import { ImageViewer } from '@/components/comments/CommentUI'
import CommentsSheet from '@/components/comments/CommentsSheet'
import Postcard from '@/components/postCard/PostCard'
import ShareModal from '@/components/posts/ShareModal'
import { AmbientBackground, GlassHeader, HEADER_H } from '@/components/savedPosts/SavedUI'
import { useSharedPost } from '@/components/services/chat/sharedPost'
import type { PostcardProps } from '@/components/services/feed/postUtils'
import OrbitLoader from '@/components/ui/OrbitLoader'
import { useCurrentUser, useShare } from '@/hooks/feed/useHomeFeed'
import { useSharedItems, type SharedItem } from '@/hooks/chats/useSharedItems'
import type { FeedTab } from '@/hooks/feed/useFeedTabs'
import type { RootState } from '@/redux/store'
import { FeedTabs } from '@/components/feed/FeedTabs' // <- adjust path
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
// import { SharedTabs } from '@/components/chats/SharedTabs'
import { Stack, useLocalSearchParams } from 'expo-router'

const LABELS = ['Posts', 'Media'] as const
const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) }
const SWITCH_RATIO = 0.2
const FLING = 500

/* ---------- pan-to-switch pager state (finger tracked, no bounce) ---------- */
function useSharedTabs() {
    const { width } = useWindowDimensions()
    const position = useSharedValue(0)
    const start = useSharedValue(0)
    const [tab, setTab] = useState<FeedTab>(0)

    const goTo = useCallback((n: number) => {
        const t = (n ? 1 : 0) as FeedTab
        setTab(t)
        position.value = withTiming(t, SLIDE)
    }, [position])

    const gesture = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-12, 12])
                .failOffsetY([-14, 14])
                .onStart(() => { start.value = Math.round(position.value) })
                .onUpdate((e) => { position.value = Math.min(1, Math.max(0, start.value - e.translationX / width)) })
                .onEnd((e) => {
                    const t = start.value
                    const commit = t === 0 ? e.translationX < -width * SWITCH_RATIO || e.velocityX < -FLING : e.translationX > width * SWITCH_RATIO || e.velocityX > FLING
                    const target = commit ? 1 - t : t
                    position.value = withTiming(target, SLIDE)
                    runOnJS(setTab)(target as FeedTab)
                }),
        [position, start, width]
    )
    return { tab, position, gesture, goTo, width }
}

/* ---------- helpers ---------- */
const formatSharedAt = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const now = new Date()
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((day(now) - day(d)) / 86400000)
    if (diff === 0) return `Today, ${time}`
    if (diff === 1) return `Yesterday, ${time}`
    const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) })
    return `${date}, ${time}`
}
const fmtDur = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const Empty = ({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) => (
    <View className="items-center px-10 pt-24">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
            <Ionicons name={icon} size={26} color="rgba(255,255,255,0.5)" />
        </View>
        <Text className="mt-4 text-center text-[14px] text-white/50">{text}</Text>
    </View>
)

const Footer = ({ loading, hasMore, hasItems }: { loading: boolean; hasMore: boolean; hasItems: boolean }) =>
    loading && hasMore ? (
        <View className="items-center py-6"><ActivityIndicator color="#fff" /></View>
    ) : hasItems ? (
        <Text className="py-6 text-center text-[12px] text-white/30">That's everything</Text>
    ) : null

/* ---------- posts tab ---------- */
type PostItemProps = { item: SharedItem; visible: boolean; contactName: string; onComments: (id: string) => void; onShare: (id: string) => void }

const PostItem = memo(function PostItem({ item, visible, contactName, onComments, onShare }: PostItemProps) {
    const uid = useSelector((s: RootState) => (s as any).profile?.userId ?? null) as string | null
    const { post, failed } = useSharedPost(item.postId!, item.post, true, true)

    const card = useMemo(
        () =>
            post && post.likesCount !== undefined // wait for the full post so counts and like state are right
                ? ({
                    id: post.id,
                    author: post.author ?? { username: 'Unknown' },
                    createdAt: post.createdAt ?? item.at,
                    content: post.content ?? '',
                    image: post.image,
                    video: post.video,
                    voiceNote: post.voiceNote,
                    voiceNoteDuration: post.voiceNoteDuration,
                    mediaWidth: post.mediaWidth,
                    mediaHeight: post.mediaHeight,
                    likesCount: post.likesCount ?? 0,
                    commentsCount: post.commentsCount ?? 0,
                    isLikedByCurrentUser: post.isLikedByCurrentUser ?? (!!uid && !!post.likedBy?.includes(uid)),
                    isSaved: false,
                    orbital: post.orbital,
                } as unknown as PostcardProps)
                : null,
        [post, uid, item.at]
    )

    return (
        <View className="mb-5">
            <View className="mb-2 px-4">
                <View className="flex-row items-center self-start rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                    <Ionicons name="paper-plane-outline" size={11} color="rgba(255,255,255,0.7)" />
                    <Text className="ml-1.5 text-[12px] font-medium text-white/60">
                        {item.mine ? 'You' : contactName} shared · {formatSharedAt(item.at)}
                    </Text>
                </View>
            </View>
            {card ? (
                <Postcard key={card.id} {...card} isVisible={visible} onPressComments={() => onComments(card.id)} onClickShare={onShare} />
            ) : failed ? (
                <View className="mx-4 items-center rounded-2xl border border-white/10 bg-white/[0.04] py-10">
                    <Ionicons name="alert-circle-outline" size={22} color="rgba(255,255,255,0.5)" />
                    <Text className="mt-2 text-[13px] text-white/50">Post unavailable</Text>
                </View>
            ) : (
                <View className="mx-4 h-72 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <ActivityIndicator color="rgba(255,255,255,0.6)" />
                </View>
            )}
        </View>
    )
})

/* ---------- media tab ---------- */
const MediaTile = memo(function MediaTile({ item, size, onPress }: { item: SharedItem; size: number; onPress: (i: SharedItem) => void }) {
    const m = item.media!
    return (
        <Pressable onPress={() => onPress(item)} style={{ width: size, height: size }} className="p-[1px] active:opacity-80">
            <View className="flex-1 overflow-hidden bg-neutral-900">
                {m.type === 'video' ? (
                    <View className="flex-1 items-center justify-center bg-neutral-900">
                        <View className="h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50">
                            <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                        </View>
                        {!!m.duration && (
                            <View className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5">
                                <Text className="text-[10px] font-semibold text-white">{fmtDur(m.duration)}</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} cachePolicy="memory-disk" recyclingKey={m.url} />
                )}
                {m.type === 'gif' && (
                    <View className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5">
                        <Text className="text-[9px] font-extrabold text-white">GIF</Text>
                    </View>
                )}
            </View>
        </Pressable>
    )
})

/* ---------- screen ---------- */
export function SharedScreen({ contactId, postId }: { contactId: string; postId?: string }) {
    const insets = useSafeAreaInsets()
    const { tab, position, gesture, goTo, width } = useSharedTabs()
    const friends = useSelector((s: RootState) => s.friends.friends) as { _id: string; username: string }[]
    const contactName = friends.find((f) => f._id === contactId)?.username ?? 'them'

    const currentUser = useCurrentUser()
    const share = useShare()

    const [seenMedia, setSeenMedia] = useState(false)
    useEffect(() => { if (tab === 1) setSeenMedia(true) }, [tab])

    const posts = useSharedItems(contactId, 'posts', true)
    const media = useSharedItems(contactId, 'media', seenMedia)

    const [commentsPostId, setCommentsPostId] = useState<string | null>(null)
    const [viewImage, setViewImage] = useState<string | null>(null)
    const [viewVideo, setViewVideo] = useState<string | null>(null)
    const [visibleId, setVisibleId] = useState<string | null>(null)

    const onViewable = useRef(({ viewableItems }: { viewableItems: { key: string }[] }) => setVisibleId(viewableItems[0]?.key ?? null)).current
    const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

    /* open on the tapped post: keep paging until it shows up, then jump to it */
    const listRef = useRef<FlatList<SharedItem>>(null)
    const jumped = useRef(!postId)
    const tries = useRef(0)
    const [ready, setReady] = useState(!postId)

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 2500)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        if (jumped.current || !posts.loaded || posts.loading) return
        const index = posts.items.findIndex((i) => i.postId === postId)
        if (index >= 0) {
            jumped.current = true
            requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({ index, animated: false })
                setTimeout(() => setReady(true), 180)
            })
        } else if (posts.hasMore && tries.current < 8) {
            tries.current += 1
            posts.loadMore()
        } else {
            jumped.current = true
            setReady(true)
        }
    }, [posts.items, posts.loaded, posts.loading, posts.hasMore, postId]) // eslint-disable-line react-hooks/exhaustive-deps

    const currentUserProps = { id: currentUser?.id, username: currentUser?.username, profilePic: currentUser?.profilePic }
    const top = insets.top + HEADER_H + 8
    const size = Math.floor(width / 3)

    const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -position.value * width }] }))

    const renderPost = useCallback(
        ({ item }: { item: SharedItem }) => (
            <PostItem item={item} visible={tab === 0 && visibleId === item.id} contactName={contactName} onComments={setCommentsPostId} onShare={share.open} />
        ),
        [tab, visibleId, contactName, share.open]
    )

    const openMedia = useCallback((i: SharedItem) => {
        if (!i.media) return
        if (i.media.type === 'video') setViewVideo(i.media.url)
        else setViewImage(i.media.url)
    }, [])
    const renderTile = useCallback(({ item }: { item: SharedItem }) => <MediaTile item={item} size={size} onPress={openMedia} />, [size, openMedia])

    return (
        <View className="flex-1 bg-[#07070A]">
            <AmbientBackground />
            <GlassHeader title="Shared" alwaysVisible />

            <View style={{ paddingTop: top }} className="pb-3">
                <FeedTabs position={position} active={tab} onSelect={goTo} labels={LABELS} />
            </View>

            <GestureDetector gesture={gesture}>
                <View className="flex-1 overflow-hidden">
                    <Animated.View style={[{ flex: 1, flexDirection: 'row', width: width * 2 }, pagerStyle]}>
                        {/* page 1: shared posts, newest first */}
                        <View style={{ width, opacity: ready ? 1 : 0 }}>
                            <FlatList
                                ref={listRef}
                                data={posts.items}
                                keyExtractor={(i) => i.id}
                                renderItem={renderPost}
                                extraData={`${visibleId}-${tab}`}
                                onViewableItemsChanged={onViewable}
                                viewabilityConfig={viewConfig}
                                onEndReached={posts.loadMore}
                                onEndReachedThreshold={1}
                                refreshing={posts.refreshing}
                                onRefresh={posts.refresh}
                                onScrollToIndexFailed={(info) => {
                                    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
                                    setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 150)
                                }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 48 }}
                                ListEmptyComponent={posts.loaded ? <Empty icon="paper-plane-outline" text="No shared posts yet" /> : null}
                                ListFooterComponent={<Footer loading={posts.loading} hasMore={posts.hasMore} hasItems={posts.items.length > 0} />}
                                windowSize={5}
                                maxToRenderPerBatch={4}
                                initialNumToRender={4}
                            />
                        </View>

                        {/* page 2: photos, GIFs and videos */}
                        <View style={{ width }}>
                            <FlatList
                                data={media.items}
                                keyExtractor={(i) => i.id}
                                renderItem={renderTile}
                                numColumns={3}
                                onEndReached={media.loadMore}
                                onEndReachedThreshold={1}
                                refreshing={media.refreshing}
                                onRefresh={media.refresh}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
                                ListEmptyComponent={media.loaded ? <Empty icon="images-outline" text="No shared photos or videos yet" /> : null}
                                ListFooterComponent={<Footer loading={media.loading} hasMore={media.hasMore} hasItems={media.items.length > 0} />}
                            />
                        </View>
                    </Animated.View>
                </View>
            </GestureDetector>

            <CommentsSheet
                visible={commentsPostId !== null}
                postId={commentsPostId}
                onClose={() => setCommentsPostId(null)}
                currentUser={currentUserProps}
                onCountChange={() => { }}
            />
            <ShareModal visible={share.shareId !== null} postId={share.shareId} friends={share.friends} orbitals={share.orbitals} onClose={share.close} />
            <ImageViewer uri={viewImage} onClose={() => setViewImage(null)} />
            <VideoViewer uri={viewVideo} onClose={() => setViewVideo(null)} />

            <OrbitLoader visible={!ready || (posts.loading && !posts.loaded)} />
        </View>
    )
}

export default function SharedRoute() {
    const { contactId, postId } = useLocalSearchParams<{ contactId: string; postId?: string }>()
    return (
        <>
            <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#07070A' } }} />
            {contactId ? <SharedScreen contactId={contactId} postId={postId} /> : null}
        </>
    )
}