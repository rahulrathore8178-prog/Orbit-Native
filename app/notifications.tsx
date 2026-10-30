import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell, CheckCheck, ChevronRight, Heart, MessageCircle, UserPlus } from 'lucide-react-native';
import Animated, {
    Easing,
    FadeInDown,
    ZoomIn,
    ZoomOut,
    interpolateColor,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/redux/store';
import {
    fetchNotifications,
    markAllRead,
    markRead,
    markSeen,
    selectNotifications,
    selectNotificationsStatus,
    selectUnreadCount,
} from '@/redux/slice/notifications/notificationsSlice';
import type { AppNotification } from '@/components/services/notifications/notificationsApi';
import OrbitBackdrop from '@/components/ui/OrbitBackdrop';
import { GlassHeader, HEADER_H, StateView } from '@/components/savedPosts/SavedUI';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { NotificationTarget, resolveNotificationTarget } from '@/components/services/notifications/NotificationTarget';
import { expandThen, Rect } from '@/components/notification/NotificationExpand';

/* ───────────── helpers ───────────── */
const timeAgo = (value: string) => {
    const s = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(value).toLocaleDateString();
};

const iconFor = (n: AppNotification) => {
    const t = `${n.type ?? ''} ${n.title}`.toLowerCase();
    if (t.includes('like')) return Heart;
    if (t.includes('comment')) return MessageCircle;
    if (t.includes('friend') || t.includes('request')) return UserPlus;
    return Bell;
};

const sectionOf = (iso: string) => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const t = new Date(iso).getTime();
    if (t >= startOfToday) return 'Today';
    if (t >= startOfToday - 6 * 86_400_000) return 'This week';
    return 'Earlier';
};

type Row =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'item'; key: string; item: AppNotification; index: number };

/* ───────────── row ───────────── */
const NotificationRow = memo(function NotificationRow({
    item, index, onOpen,
}: { item: AppNotification; index: number; onOpen: (t: NotificationTarget, rect: Rect) => void }) {
    const dispatch = useAppDispatch();
    const read = useSharedValue(item.isRead ? 1 : 0);
    const scale = useSharedValue(1);
    const boxRef = useRef<View>(null);
    const Icon = iconFor(item);
    const target = useMemo(() => resolveNotificationTarget(item), [item]);

    useEffect(() => {
        read.value = withTiming(item.isRead ? 1 : 0, { duration: 280 });
    }, [item.isRead, read]);

    const card = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: interpolateColor(read.value, [0, 1], ['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.025)']),
        borderColor: interpolateColor(read.value, [0, 1], ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']),
    }));
    const dot = useAnimatedStyle(() => ({
        opacity: 1 - read.value,
        transform: [{ scale: 1 - read.value * 0.5 }],
    }));

    const press = () => {
        if (!item.isRead) dispatch(markRead(item._id)); // mark read always works
        if (!target) {
            if (!item.isRead) Haptics.selectionAsync();
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        boxRef.current?.measureInWindow((x, y, w, h) => onOpen(target, { x, y, w, h }));
    };

    return (
        <View ref={boxRef} collapsable={false} className="mx-4 mb-2">
            <Animated.View
                entering={index < 10 ? FadeInDown.delay(index * 40).springify().damping(20) : undefined}
                style={card}
                className="overflow-hidden rounded-2xl border"
            >
                <Pressable
                    onPress={press}
                    onPressIn={() => (scale.value = withSpring(0.98, { damping: 18, stiffness: 320 }))}
                    onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 320 }))}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}${item.isRead ? '' : ', unread'}`}
                    className="flex-row items-center px-4 py-3.5"
                >
                    <View className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                        <Icon size={18} color="rgba(255,255,255,0.85)" />
                    </View>
                    <View className="ml-3 min-w-0 flex-1">
                        <Text className="text-[14px] font-semibold text-white">{item.title}</Text>
                        {!!item.detail && <Text className="mt-0.5 text-[13px] leading-[18px] text-white/50">{item.detail}</Text>}
                        <Text className="mt-1 text-[11px] text-white/35">{timeAgo(item.createdAt)}</Text>
                    </View>
                    <Animated.View
                        style={[dot, { shadowColor: '#fb7185', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }]}
                        className="ml-3 h-2.5 w-2.5 rounded-full bg-rose-400"
                    />
                    {target && <ChevronRight size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 6 }} />}
                </Pressable>
            </Animated.View>
        </View>
    );
});

/* ───────────── loading skeleton ───────────── */
function RowsSkeleton() {
    const pulse = useSharedValue(0.45);
    useEffect(() => {
        pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, [pulse]);
    const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
    return (
        <View>
            {[0, 1, 2, 3, 4].map((i) => (
                <Animated.View
                    key={i}
                    style={style}
                    className="mx-4 mb-2 h-[76px] rounded-2xl border border-white/[0.06] bg-white/[0.04]"
                />
            ))}
        </View>
    );
}

/* ───────────── screen ───────────── */
export default function NotificationsScreen() {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();
    const focused = useIsFocused();
    const items = useSelector(selectNotifications);
    const status = useSelector(selectNotificationsStatus);
    const unread = useSelector(selectUnreadCount);
    const [refreshing, setRefreshing] = useState(false);

    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });

    // fresh data every time the page opens (silent: existing rows stay on screen)
    useFocusEffect(
        useCallback(() => {
            dispatch(fetchNotifications({ silent: true }));
        }, [dispatch]),
    );

    // opening the page (and any new arrival while it is open) clears the bell's red mark
    const newest = items[0]?.createdAt;
    useEffect(() => {
        if (focused && newest) dispatch(markSeen());
    }, [focused, newest, dispatch]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await dispatch(fetchNotifications({ silent: true }));
        setRefreshing(false);
    }, [dispatch]);

    const retry = useCallback(() => {
        dispatch(fetchNotifications());
    }, [dispatch]);

    // time sections keep every row in a stable place when you tap it
    const rows = useMemo<Row[]>(() => {
        const out: Row[] = [];
        let last = '';
        items.forEach((item, index) => {
            const label = sectionOf(item.createdAt);
            if (label !== last) {
                out.push({ kind: 'header', key: `h-${label}`, label });
                last = label;
            }
            out.push({ kind: 'item', key: item._id, item, index });
        });
        return out;
    }, [items]);

    const openProfile = useOpenProfile();

    const onOpen = useCallback(
        (t: NotificationTarget, rect: Rect) =>
            expandThen(rect, () => ('profile' in t ? openProfile(t.profile) : router.push(t.href as any))),
        [openProfile],
    );

    const renderItem = useCallback(
        ({ item: row }: { item: Row }) =>
            row.kind === 'header' ? (
                <Text className="px-5 pb-2 pt-4 text-[12px] font-semibold uppercase tracking-widest text-white/35">
                    {row.label}
                </Text>
            ) : (
                <NotificationRow item={row.item} index={row.index} onOpen={onOpen} />
            ),
        [onOpen],
    );

    const loading = items.length === 0 && (status === 'idle' || status === 'loading');
    const failed = items.length === 0 && status === 'error';
    const empty = items.length === 0 && status === 'ready';

    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
            <OrbitBackdrop />
            <GlassHeader title="Notifications" scrollY={scrollY} />

            <Animated.FlatList
                data={rows}
                keyExtractor={(r) => r.key}
                renderItem={renderItem}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                windowSize={9}
                contentContainerStyle={{ paddingTop: insets.top + HEADER_H, paddingBottom: insets.bottom + 40 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#ffffff"
                        progressViewOffset={insets.top + HEADER_H}
                    />
                }
                ListHeaderComponent={
                    <View className="flex-row items-end justify-between px-5 pb-3 pt-2">
                        <View className="flex-1">
                            <Text className="text-[34px] font-bold tracking-tight text-white">Notifications</Text>
                            <Text className="mt-1 text-[14px] text-white/45">
                                {unread > 0 ? `${unread} unread` : "You're all caught up"}
                            </Text>
                        </View>
                        {unread > 0 && (
                            <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(150)}>
                                <Pressable
                                    onPress={() => {
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        dispatch(markAllRead());
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Mark all as read"
                                    className="flex-row items-center rounded-full border border-white/[0.12] bg-white/[0.07] px-3.5 py-2 active:bg-white/15"
                                >
                                    <CheckCheck size={14} color="#fff" />
                                    <Text className="ml-1.5 text-[12.5px] font-semibold text-white">Mark all read</Text>
                                </Pressable>
                            </Animated.View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    loading ? (
                        <RowsSkeleton />
                    ) : failed ? (
                        <StateView
                            icon="cloud-offline-outline"
                            title="Couldn't load notifications"
                            message="Check your connection and try again."
                            action="Try again"
                            onAction={retry}
                        />
                    ) : empty ? (
                        <StateView
                            icon="checkmark-done-outline"
                            title="You're all caught up"
                            message="Likes, comments and friend requests will show up here."
                            action="Find people"
                            onAction={() => router.push('/search')}
                        />
                    ) : undefined
                }
            />
        </View>
    );
}
