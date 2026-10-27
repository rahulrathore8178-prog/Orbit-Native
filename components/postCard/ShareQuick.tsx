import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    makeMutable,
    measure,
    runOnJS,
    useAnimatedReaction,
    useAnimatedRef,
    useAnimatedStyle,
    useFrameCallback,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, getDisplayImageUrl } from '../../lib/utils';
import { getAuthHeaders } from '../services/feed/postUtils';
import { sharePostToContact } from '../services/chat/sharePost';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

/**
 * TODO: point these at your real endpoints.
 *  FRIENDS_URL  GET  -> your friends list. Accepts: [..] | { friends: [..] } | { users: [..] } | { data: [..] }
 *                       each item: { _id | id, username, profilePic }  (or { user: {...} })
 *  SHARE_URL    POST -> body { postId, recipientIds: string[] } — delivers the post as a chat message
 */
export const FRIENDS_URL = `${API_URL}/api/social/friends`;
export const SHARE_URL = `${API_URL}/api/chat/share-post`;

/** How long the finger must rest on the share button before the friend list opens. */
export const HOLD_MS = 400;
/** Max friends loaded into the quick list (all are reachable by panning/scrolling). */
const MAX_FRIENDS = 40;
/** Rows visible at once; more than this and the list scrolls while your finger sits near the top/bottom edge. */
const VISIBLE = 5;

const ITEM_H = 56;
const LIST_W = 220;
const PAD = 6;
const GAP = 14;
const SIDE_SLACK = 36; // horizontal forgiveness while panning
const EDGE = 56; // px zone at top/bottom of the list that triggers auto-scroll
const EDGE_OUT = 70; // how far outside the list the finger can be and still scroll
const SCROLL_SPEED = 460; // px/s at the very edge
const HIDDEN_Y = -170;

/* ------------------------------------------------------------------ */
/* Shared avatar url + component (also used by ShareSheet)             */
/* ------------------------------------------------------------------ */

export type Recipient = {
    _id: string;
    username: string;
    profilePic?: string;
    [k: string]: any;
};

/** Same resolution Postcard uses for images: server paths get the host, absolute (Drive) links go through getDisplayImageUrl. */
export function resolveAvatar(u: Recipient): string | undefined {
    const raw: any = u.profilePic ?? u.profilePicture ?? u.avatar ?? u.image ?? u.photo;
    const val: string | undefined = typeof raw === 'string' ? raw : raw?.url;
    if (!val) return undefined;
    if (val.startsWith('/')) return `${API_URL}${val}`;
    try {
        return (getDisplayImageUrl(val) as string | undefined) || val;
    } catch {
        return val;
    }
}

export const Avatar = memo(function Avatar({ user, size }: { user: Recipient; size: number }) {
    const [failed, setFailed] = useState(false);
    const uri = resolveAvatar(user);
    const r = size / 2;
    if (uri && !failed) {
        return (
            <Image
                source={{ uri }}
                onError={() => setFailed(true)}
                style={{ width: size, height: size, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.1)' }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: r,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
            }}
        >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>
                {(user.username || '?').charAt(0).toUpperCase()}
            </Text>
        </View>
    );
});

/* ------------------------------------------------------------------ */
/* Tiny store (friends, active post, toast text)                       */
/* ------------------------------------------------------------------ */

let friends: Recipient[] = [];
let activePostId: string | null = null;
let toastMsg: { text: string; sub?: string; ok: boolean } = { text: 'Shared', ok: true };
let safeTop = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

// UI-thread state shared by gesture <-> overlay
const S = {
    progress: makeMutable(0),
    hover: makeMutable(-1),
    left: makeMutable(0),
    top: makeMutable(0),
    count: makeMutable(0),
    safeTop: makeMutable(0),
    toastY: makeMutable(HIDDEN_Y),
    open: makeMutable(false),
    fingerX: makeMutable(0),
    fingerY: makeMutable(0),
    scrollY: makeMutable(0),
};

/** Height of the visible window for n friends (shows half a row extra when scrollable, as a hint). */
function vpHeight(n: number) {
    'worklet';
    const c = Math.max(1, n);
    return (c > VISIBLE ? VISIBLE + 0.5 : c) * ITEM_H;
}

/** Which friend is under the finger right now (accounts for scroll). Runs on the UI thread. */
function computeHover() {
    'worklet';
    const n = S.count.value;
    const vp = vpHeight(n);
    const relY = S.fingerY.value - (S.top.value + PAD);
    const inX = S.fingerX.value > S.left.value - SIDE_SLACK && S.fingerX.value < S.left.value + LIST_W + SIDE_SLACK;
    let idx = -1;
    if (inX && relY >= 0 && relY < vp) {
        idx = Math.floor((relY + S.scrollY.value) / ITEM_H);
        if (idx >= n) idx = -1;
    }
    if (idx !== S.hover.value) S.hover.value = idx;
}

export async function fetchRecipients(currentUserId?: string): Promise<Recipient[]> {
    const res = await axios.get(FRIENDS_URL, { withCredentials: true, headers: await getAuthHeaders() });
    const d = res.data;
    const arr: any[] = Array.isArray(d) ? d : d?.friends ?? d?.users ?? d?.data ?? [];
    return arr
        .map((f) => {
            const u = f?.user ?? f;
            const _id = typeof u === 'string' ? u : u?._id ?? u?.id ?? '';
            return { ...(typeof u === 'object' ? u : {}), _id: String(_id), username: u?.username ?? '', profilePic: u?.profilePic } as Recipient;
        })
        .filter((u) => u._id && u._id !== currentUserId);
}

let loadPromise: Promise<void> | null = null;
let myId: string | undefined;

/** Loads friends once; safe to call repeatedly (e.g. on press-in) — retries if the list is still empty. */
export function ensureFriends(currentUserId?: string) {
    if (currentUserId) myId = currentUserId;
    if (friends.length > 0 || loadPromise) return;
    loadPromise = fetchRecipients(myId)
        .then((l) => {
            friends = l.slice(0, MAX_FRIENDS);
            emit();
        })
        .catch((e) => console.error('[ShareQuick] friends load failed:', e?.response?.status, e?.response?.data ?? e))
        .finally(() => {
            loadPromise = null;
        });
}

/** Slides a glass toast down from the top, lets it breathe, then slides it back up. */
export function showShareToast(text = 'Shared', sub?: string, ok = true) {
    toastMsg = { text, sub, ok };
    emit();
    S.toastY.value = HIDDEN_Y;
    S.toastY.value = withSequence(
        withSpring(safeTop + 10, { damping: 13, stiffness: 170, mass: 0.9 }),
        withDelay(1500, withTiming(HIDDEN_Y, { duration: 340, easing: Easing.in(Easing.cubic) })),
    );
}

async function sendTo(friend: Recipient, postId: string) {
    try {
        await sharePostToContact(friend._id, postId);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showShareToast('Shared', `to ${friend.username}`);
    } catch (e: any) {
        console.error('Quick share error:', e?.response?.status, e?.response?.data ?? e);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showShareToast("Couldn't send", 'Try again', false);
    }
}

/* ------------------------------------------------------------------ */
/* Hold + pan button                                                   */
/* ------------------------------------------------------------------ */

type HoldProps = {
    postId: string;
    onPress: () => void;
    children: React.ReactNode;
    className?: string;
    accessibilityLabel?: string;
};

const noop = () => {};

export function ShareHoldButton({ postId, onPress, children, className, accessibilityLabel }: HoldProps) {
    const ref = useAnimatedRef<Animated.View>();
    const active = useSharedValue(false);

    const onOpen = useRef((id: string) => {
        ensureFriends();
        activePostId = id;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }).current;

    const onRelease = useRef((idx: number) => {
        const f = idx >= 0 ? friends[idx] : undefined;
        const id = activePostId;
        activePostId = null;
        if (f && id) sendTo(f, id);
    }).current;

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activateAfterLongPress(HOLD_MS)
                .shouldCancelWhenOutside(false)
                .onStart((e) => {
                    'worklet';
                    runOnJS(onOpen)(postId);
                    const m = measure(ref);
                    if (!m) return;
                    const vp = vpHeight(S.count.value);
                    S.left.value = Math.max(12, m.pageX + m.width + 4 - LIST_W);
                    S.top.value = Math.max(S.safeTop.value + 8, m.pageY - GAP - (vp + PAD * 2));
                    S.scrollY.value = 0;
                    S.hover.value = -1;
                    S.fingerX.value = e.absoluteX;
                    S.fingerY.value = e.absoluteY;
                    active.value = true;
                    S.open.value = true;
                    S.progress.value = withSpring(1, { damping: 16, stiffness: 240, mass: 0.7 });
                })
                .onUpdate((e) => {
                    'worklet';
                    if (!active.value) return;
                    S.fingerX.value = e.absoluteX;
                    S.fingerY.value = e.absoluteY;
                    computeHover();
                })
                .onFinalize(() => {
                    'worklet';
                    if (!active.value) return;
                    active.value = false;
                    S.open.value = false;
                    const idx = S.hover.value;
                    S.progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (fin) => {
                        if (fin) S.hover.value = -1;
                    });
                    runOnJS(onRelease)(idx);
                }),
        [ref, active, postId, onOpen, onRelease],
    );

    const btnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(active.value ? 0.88 : 1, { damping: 14, stiffness: 260 }) }],
    }));

    return (
        <GestureDetector gesture={pan}>
            <Animated.View ref={ref} collapsable={false} style={btnStyle}>
                {/* Pressable owns the JS touch so the parent card's long-press can't steal it;
                    the empty onLongPress also suppresses onPress after a hold. */}
                <Pressable
                    onPressIn={() => ensureFriends()}
                    onPress={onPress}
                    onLongPress={noop}
                    delayLongPress={HOLD_MS}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    className={className}
                >
                    {children}
                </Pressable>
            </Animated.View>
        </GestureDetector>
    );
}

/* ------------------------------------------------------------------ */
/* Overlay (mount ONCE at app root)                                    */
/* ------------------------------------------------------------------ */

const Row = memo(function Row({ user, index }: { user: Recipient; index: number }) {
    const stagger = Math.min(index, 4) * 0.08;
    const rowStyle = useAnimatedStyle(() => {
        const on = S.hover.value === index;
        return {
            backgroundColor: withTiming(on ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0)', { duration: 120 }),
            transform: [
                { scale: withSpring(on ? 1.06 : 1, { damping: 15, stiffness: 320 }) },
                { translateX: withSpring(on ? -6 : 0, { damping: 15, stiffness: 320 }) },
            ],
            opacity: interpolate(S.progress.value, [0.15 + stagger, 0.6 + stagger], [0, 1], Extrapolation.CLAMP),
        };
    });
    const avatarStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(S.hover.value === index ? 1.14 : 1, { damping: 12, stiffness: 300 }) }],
    }));
    return (
        <Animated.View
            style={[
                { height: ITEM_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 20 },
                rowStyle,
            ]}
        >
            <Animated.View style={avatarStyle}>
                <Avatar user={user} size={40} />
            </Animated.View>
            <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, color: '#fff', fontSize: 15, fontWeight: '600' }}>
                {user.username}
            </Text>
        </Animated.View>
    );
});

export function ShareQuickHost({ currentUserId }: { currentUserId?: string }) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const list = useSyncExternalStore(subscribe, () => friends);
    const msg = useSyncExternalStore(subscribe, () => toastMsg);
    const shown = list.slice(0, MAX_FRIENDS);
    const vp = vpHeight(shown.length);

    useEffect(() => {
        safeTop = insets.top;
        S.safeTop.value = insets.top;
    }, [insets.top]);

    useEffect(() => {
        ensureFriends(currentUserId);
    }, [currentUserId]);

    useEffect(() => {
        S.count.value = shown.length;
    }, [shown.length]);

    // light tick whenever the finger moves onto a different friend
    useAnimatedReaction(
        () => S.hover.value,
        (cur, prev) => {
            if (cur >= 0 && cur !== prev && Platform.OS !== 'web') runOnJS(Haptics.selectionAsync)();
        },
    );

    // auto-scroll while the finger rests near the top/bottom edge of the list
    useFrameCallback((frame) => {
        'worklet';
        if (!S.open.value) return;
        const n = S.count.value;
        if (n <= VISIBLE) return;
        const h = vpHeight(n);
        const maxScroll = n * ITEM_H - h;
        const relY = S.fingerY.value - (S.top.value + PAD);
        const inX = S.fingerX.value > S.left.value - SIDE_SLACK && S.fingerX.value < S.left.value + LIST_W + SIDE_SLACK;
        if (!inX) return;
        let v = 0;
        if (relY < EDGE && relY > -EDGE_OUT) v = -Math.min(1, (EDGE - relY) / EDGE);
        else if (relY > h - EDGE && relY < h + EDGE_OUT) v = Math.min(1, (relY - (h - EDGE)) / EDGE);
        if (v === 0) return;
        const dt = frame.timeSincePreviousFrame ?? 16;
        const next = Math.min(maxScroll, Math.max(0, S.scrollY.value + (v * SCROLL_SPEED * dt) / 1000));
        if (next !== S.scrollY.value) {
            S.scrollY.value = next;
            computeHover();
        }
    });

    const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(S.progress.value, [0, 1], [0, 0.45], Extrapolation.CLAMP) }));
    const panel = useAnimatedStyle(() => ({
        left: S.left.value,
        top: S.top.value,
        opacity: interpolate(S.progress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(S.progress.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
            { scale: interpolate(S.progress.value, [0, 1], [0.9, 1], Extrapolation.CLAMP) },
        ],
    }));
    const content = useAnimatedStyle(() => ({ transform: [{ translateY: -S.scrollY.value }] }));
    const topFade = useAnimatedStyle(() => ({ opacity: interpolate(S.scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));
    const bottomFade = useAnimatedStyle(() => {
        const n = S.count.value;
        const maxScroll = Math.max(0, n * ITEM_H - vpHeight(n));
        return { opacity: interpolate(maxScroll - S.scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP) };
    });
    const toast = useAnimatedStyle(() => ({ transform: [{ translateY: S.toastY.value }] }));

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdrop]} />

            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        width: LIST_W,
                        height: vp + PAD * 2,
                        borderRadius: 28,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.16)',
                    },
                    panel,
                ]}
            >
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,18,0.82)' }]} />

                <View style={{ margin: PAD, height: vp, overflow: 'hidden' }}>
                    {shown.length === 0 ? (
                        <View style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>No friends to show</Text>
                        </View>
                    ) : (
                        <Animated.View style={content}>
                            {shown.map((u, i) => (
                                <Row key={u._id} user={u} index={i} />
                            ))}
                        </Animated.View>
                    )}

                    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 28 }, topFade]}>
                        <LinearGradient colors={['rgba(10,12,18,0.95)', 'rgba(10,12,18,0)']} style={{ flex: 1 }} />
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 }, bottomFade]}>
                        <LinearGradient colors={['rgba(10,12,18,0)', 'rgba(10,12,18,0.95)']} style={{ flex: 1 }} />
                    </Animated.View>
                </View>
            </Animated.View>

            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }, toast]}>
                <View
                    style={{
                        maxWidth: width - 48,
                        borderRadius: 999,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.18)',
                    }}
                >
                    <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,18,0.6)' }]} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 18 }}>
                        <View
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: msg.ok ? 'rgba(255,255,255,0.95)' : 'rgba(251,113,133,0.95)',
                            }}
                        >
                            <Ionicons name={msg.ok ? 'checkmark' : 'close'} size={15} color="#0a0c12" />
                        </View>
                        <Text style={{ marginLeft: 10, color: '#fff', fontSize: 14, fontWeight: '700' }}>{msg.text}</Text>
                        {msg.sub ? (
                            <Text numberOfLines={1} style={{ marginLeft: 6, color: 'rgba(255,255,255,0.6)', fontSize: 13, flexShrink: 1 }}>
                                {msg.sub}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}