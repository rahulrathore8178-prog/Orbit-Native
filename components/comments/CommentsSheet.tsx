import { BlurView } from 'expo-blur';
import { MessageCircle, X } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Animated, Easing, FlatList, Keyboard, Modal, PanResponder, Platform, Pressable,
    RefreshControl, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../posts/PostMedia';
import {
    Comment, Draft, deleteCommentApi, errMsg, makeTempComment, postComment, setLikeApi, useComments,
} from '../services/comments/commentsApi';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import { CommentSkeleton, FadeIn, ImageViewer } from './CommentUI';
import { useKeyboardOverlap } from './useKeyboardOverlap';

type Thread = { top: Comment; replies: Comment[] };
type Pending = { postId: string; draft: Draft; rootId: string | null; replyToId: string | null };

type Props = {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
    currentUser: { _id: string; username: string; profilePic?: string };
    /** +n / -n so the post card's comment count stays in sync */
    onCountChange?: (postId: string, delta: number) => void;
};

const RAIL = 'rgba(255,255,255,0.14)';
const FIRST_BATCH = 3;
const MORE_BATCH = 5;

const confirmAsync = (title: string, message: string, confirmText: string) =>
    Platform.OS === 'web'
        ? Promise.resolve(window.confirm(`${title}\n\n${message}`))
        : new Promise<boolean>((resolve) =>
            Alert.alert(title, message, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
            ], { cancelable: true, onDismiss: () => resolve(false) })
        );

const Separator = () => <View style={styles.sep} />;

/* ---------- one thread: top comment + collapsible, incrementally revealed replies ---------- */
type ThreadProps = {
    thread: Thread;
    index: number;
    shown: number;
    meId: string;
    setShown: (rootId: string, n: number) => void;
    onLike: (c: Comment) => void;
    onReply: (c: Comment) => void;
    onDelete: (c: Comment) => void;
    onRetry: (c: Comment) => void;
    onDiscard: (c: Comment) => void;
    onOpenImage: (url: string) => void;
};

const ThreadView = memo(function ThreadView({ thread, index, shown, meId, setShown, ...h }: ThreadProps) {
    const { top, replies } = thread;

    // Mine = written by the signed-in user (author id match), or a temp bubble that is still sending.
    const isMine = (c: Comment) => (!!meId && c.author._id === meId) || !!c.key?.startsWith('tmp-');
    const mine = isMine(top); // my thread: rail and links sit on the right, like my bubble

    const visible = replies.slice(0, shown);
    const hidden = replies.length - visible.length;

    const label =
        shown === 0
            ? `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
            : hidden > 0
                ? `Show ${Math.min(MORE_BATCH, hidden)} more ${hidden === 1 ? 'reply' : 'replies'}`
                : 'Hide replies';

    const onToggle = () => {
        if (shown === 0) setShown(top._id, FIRST_BATCH);
        else if (hidden > 0) setShown(top._id, shown + MORE_BATCH);
        else setShown(top._id, 0);
    };

    return (
        <View>
            <CommentItem comment={top} index={index} isOwn={mine} {...h} />

            {replies.length > 0 ? (
                <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {visible.length > 0 ? (
                        <View style={[styles.rail, mine ? styles.railMine : styles.railTheirs]}>
                            {visible.map((r) => (
                                <CommentItem key={r.key ?? r._id} comment={r} isReply isOwn={isMine(r)} {...h} />
                            ))}
                        </View>
                    ) : null}
                    <Pressable
                        onPress={onToggle}
                        hitSlop={8}
                        style={[styles.moreRow, mine ? styles.moreRowMine : styles.moreRowTheirs]}
                    >
                        <View style={{ width: 22, height: 1.5, backgroundColor: RAIL }} />
                        <Text style={styles.moreText}>{label}</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
});

/* ---------- sheet ---------- */
export default function CommentsSheet({ visible, postId, onClose, currentUser, onCountChange }: Props) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    // Normalise the signed-in user once: accepts `_id` or `id`, so author-id checks always match.
    const me = useMemo(() => ({
        _id: String((currentUser as any)?._id ?? (currentUser as any)?.id ?? ''),
        username: currentUser?.username,
        profilePic: currentUser?.profilePic,
    }), [currentUser]);

    const progress = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(visible);

    // Measures the real keyboard overlap, so the composer is never covered (or pushed twice).
    const containerRef = useRef<View>(null);
    const { anim: kbAnim, visible: kbVisible } = useKeyboardOverlap(containerRef, mounted);

    // keep the last post id so the list doesn't empty during the slide-out
    const [activeId, setActiveId] = useState<string | null>(postId);
    useEffect(() => {
        if (visible && postId) setActiveId(postId);
    }, [visible, postId]);

    const { comments, loading, refreshing, error, refresh, reload, add, replace, removeLocal, patch } = useComments(activeId);

    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [shown, setShownMap] = useState<Record<string, number>>({});
    const [viewing, setViewing] = useState<string | null>(null);
    const listRef = useRef<FlatList<Thread>>(null);
    const pending = useRef(new Map<string, Pending>());

    useEffect(() => {
        setReplyTo(null);
        setShownMap({});
    }, [activeId]);

    const setShown = useCallback((rootId: string, n: number) => setShownMap((s) => ({ ...s, [rootId]: n })), []);

    /* ----- sheet animation ----- */
    useEffect(() => {
        if (visible) setMounted(true);
        else Keyboard.dismiss();
    }, [visible]);

    useEffect(() => {
        if (visible && mounted) {
            Animated.timing(progress, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        } else if (!visible && mounted) {
            Animated.timing(progress, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, mounted, progress]);

    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const pan = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderMove: (_, g) => {
                    if (g.dy > 0) progress.setValue(Math.max(0, 1 - g.dy / height));
                },
                onPanResponderRelease: (_, g) => {
                    if (g.dy > 120 || g.vy > 0.9) onCloseRef.current();
                    else Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
                },
                onPanResponderTerminate: () => {
                    Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
                },
            }),
        [height, progress]
    );

    /* ----- threads ----- */
    const threads = useMemo<Thread[]>(() => {
        const byParent = new Map<string, Comment[]>();
        const tops: Comment[] = [];
        comments.forEach((c) => {
            if (c.parentId) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
            else tops.push(c);
        });
        tops.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        byParent.forEach((arr) => arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
        return tops.map((top) => ({ top, replies: byParent.get(top._id) ?? [] }));
    }, [comments]);

    /* ----- sending: shown instantly, uploaded in the background ----- */
    const deliver = useCallback(
        async (tempId: string) => {
            const p = pending.current.get(tempId);
            if (!p) return;
            patch(tempId, { status: 'sending', progress: 0, error: undefined });
            let last = 0;
            try {
                const { comment } = await postComment({
                    ...p,
                    onProgress: (v) => {
                        if (v - last >= 0.05 || v === 1) {
                            last = v;
                            patch(tempId, { progress: v });
                        }
                    },
                });
                pending.current.delete(tempId);
                replace(tempId, comment);
            } catch (e) {
                console.warn('[comment send failed]', (e as any)?.response?.status, (e as any)?.response?.data, (e as any)?.message);
                patch(tempId, { status: 'failed', error: errMsg(e, 'Could not send') });
            }
        },
        [patch, replace]
    );

    const handleSend = useCallback(
        (draft: Draft) => {
            if (!activeId) return;
            const target = replyTo;
            const rootId = target ? target.parentId ?? target._id : null;
            const replyToId = target && target.parentId ? target._id : null; // only when answering a reply

            const temp = makeTempComment(draft, me, rootId, target);
            pending.current.set(temp._id, { postId: activeId, draft, rootId, replyToId });
            add(temp);
            onCountChange?.(activeId, 1);

            if (rootId) setShown(rootId, 9999); // open the thread so the new reply is visible
            else listRef.current?.scrollToOffset({ offset: 0, animated: true });
            setReplyTo(null);
            deliver(temp._id);
        },
        [activeId, replyTo, me, add, onCountChange, deliver, setShown]
    );

    const handleRetry = useCallback((c: Comment) => { deliver(c._id); }, [deliver]);

    const handleDiscard = useCallback(
        (c: Comment) => {
            pending.current.delete(c._id);
            removeLocal(c._id);
            if (activeId) onCountChange?.(activeId, -1);
        },
        [removeLocal, activeId, onCountChange]
    );

    const handleReply = useCallback((c: Comment) => {
        if (c._id.startsWith('tmp-')) return; // can't reply to something still sending
        setReplyTo(c);
    }, []);

    const handleLike = useCallback(
        async (c: Comment) => {
            if (!activeId || c._id.startsWith('tmp-')) return;
            const liked = !c.liked;
            patch(c._id, { liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) });
            try {
                const r = await setLikeApi(activeId, c._id, liked);
                patch(c._id, { liked: r.liked, likeCount: r.likeCount });
            } catch {
                patch(c._id, { liked: c.liked, likeCount: c.likeCount });
            }
        },
        [activeId, patch]
    );

    const handleDelete = useCallback(
        async (c: Comment) => {
            if (!activeId) return;
            const ok = await confirmAsync('Delete comment?', "This can't be undone.", 'Delete');
            if (!ok) return;
            const removed = 1 + comments.filter((x) => x.parentId === c._id).length;
            removeLocal(c._id);
            onCountChange?.(activeId, -removed);
            try {
                await deleteCommentApi(activeId, c._id);
            } catch {
                refresh(); // put things back if the server refused
                onCountChange?.(activeId, removed);
            }
        },
        [activeId, comments, removeLocal, onCountChange, refresh]
    );

    /* ----- render ----- */
    if (!mounted) return null;

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
    const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

    const renderBody = () => {
        if (loading && comments.length === 0) {
            return (
                <View style={{ padding: 16, gap: 22 }}>
                    <CommentSkeleton />
                    <CommentSkeleton />
                    <CommentSkeleton />
                </View>
            );
        }

        if (error && comments.length === 0) {
            return (
                <View style={{ padding: 16 }}>
                    <GlassPanel radius={24} style={{ padding: 22, alignItems: 'center', gap: 14 }}>
                        <Text style={{ color: COLORS.muted, fontSize: 14, textAlign: 'center' }}>{error}</Text>
                        <Pressable onPress={reload}>
                            {({ pressed }) => (
                                <NeoView radius={16} pressed={pressed} contentStyle={{ paddingHorizontal: 22, paddingVertical: 10 }}>
                                    <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>Retry</Text>
                                </NeoView>
                            )}
                        </Pressable>
                    </GlassPanel>
                </View>
            );
        }

        return (
            <FlatList
                ref={listRef}
                data={threads}
                extraData={shown}
                keyExtractor={(t) => t.top.key ?? t.top._id}
                ItemSeparatorComponent={Separator}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                windowSize={7}
                removeClippedSubviews={Platform.OS === 'android'}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24, flexGrow: 1 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#fff"
                        colors={[COLORS.accent]}
                        progressBackgroundColor={COLORS.surface}
                    />
                }
                renderItem={({ item, index }) => (
                    <ThreadView
                        thread={item}
                        index={index}
                        shown={shown[item.top._id] ?? 0}
                        meId={me._id}
                        setShown={setShown}
                        onLike={handleLike}
                        onReply={handleReply}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onDiscard={handleDiscard}
                        onOpenImage={setViewing}
                    />
                )}
                ListEmptyComponent={
                    <FadeIn>
                        <View style={{ alignItems: 'center', paddingTop: 56, gap: 10 }}>
                            <NeoView radius={28} style={{ width: 60, height: 60 }}>
                                <MessageCircle size={26} color={COLORS.muted} />
                            </NeoView>
                            <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800' }}>No comments yet</Text>
                            <Text style={{ color: COLORS.muted, fontSize: 13.5 }}>Start the conversation.</Text>
                        </View>
                    </FadeIn>
                }
            />
        );
    };

    return (
        <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)', opacity: backdropOpacity }]} />
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => (kbVisible ? Keyboard.dismiss() : onClose())}
                accessibilityLabel="Close comments"
            />

            {/* collapsable={false} + ref: the keyboard hook measures this view */}
            <Animated.View
                ref={containerRef as any}
                collapsable={false}
                pointerEvents="box-none"
                style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: kbAnim }}
            >
                <Animated.View style={[styles.sheet, { height: height * 0.88, transform: [{ translateY }] }]}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,18,0.90)' }]} />

                    <View {...pan.panHandlers} style={styles.grabberArea}>
                        <View style={styles.grabber} />
                    </View>

                    <View style={styles.header}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 }}>Comments</Text>
                            <View style={styles.countPill}>
                                <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '800' }}>{comments.length}</Text>
                            </View>
                        </View>
                        <IconButton Icon={X} label="Close comments" onPress={onClose} size={40} />
                    </View>

                    <View style={{ flex: 1 }}>{renderBody()}</View>

                    <CommentComposer
                        replyingTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                        onSend={handleSend}
                        keyboardVisible={kbVisible}
                        bottomInset={insets.bottom}
                    />
                </Animated.View>
            </Animated.View>

            <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: {
        flexShrink: 1, // shrinks when the keyboard takes space, so the composer stays visible
        overflow: 'hidden',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: COLORS.glassBorder,
        backgroundColor: 'rgba(10,12,18,0.6)',
    },
    grabberArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    countPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
    sep: { height: 1, marginVertical: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
    // Replies hang off a rail: on the left for other people's threads, on the right for mine.
    rail: { alignSelf: 'stretch', marginTop: 8, gap: 16 },
    railTheirs: { marginLeft: 18, paddingLeft: 18, borderLeftWidth: 1.5, borderLeftColor: RAIL },
    railMine: { marginLeft: 24, marginRight: 6, paddingRight: 18, borderRightWidth: 1.5, borderRightColor: RAIL },
    moreRow: { alignItems: 'center', gap: 10, marginTop: 10 },
    moreRowTheirs: { flexDirection: 'row', marginLeft: 50 },
    moreRowMine: { flexDirection: 'row-reverse', marginRight: 12 },
    moreText: { color: COLORS.muted, fontSize: 12.5, fontWeight: '800' },
});