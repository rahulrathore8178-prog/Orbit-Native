import { BlurView } from 'expo-blur';
import { MessageCircle, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Keyboard,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../posts/PostMedia';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import {
    Comment,
    Draft,
    createComment,
    deleteCommentApi,
    errMsg,
    toggleLikeApi,
    useComments,
} from './commentsApi';
import { CommentSkeleton, FadeIn } from './CommentUI';
import { useKeyboardAnim } from './useKeyboard';

type Thread = { top: Comment; replies: Comment[] };

type Props = {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
    currentUser: { _id: string; username: string; profilePic?: string };
    /** +1 / -n changes so the post card's comment count can stay in sync */
    onCountChange?: (postId: string, delta: number) => void;
};

const confirmAsync = (title: string, message: string, confirmText: string) =>
    Platform.OS === 'web'
        ? Promise.resolve(window.confirm(`${title}\n\n${message}`))
        : new Promise<boolean>((resolve) =>
            Alert.alert(
                title,
                message,
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
            )
        );

const Separator = () => <View style={{ height: 18 }} />;

export default function CommentsSheet({ visible, postId, onClose, currentUser, onCountChange }: Props) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { anim: kbAnim, visible: kbVisible } = useKeyboardAnim();

    const progress = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(visible);

    // keep the last post id so the list doesn't empty out during the slide-out animation
    const [activeId, setActiveId] = useState<string | null>(postId);
    useEffect(() => {
        if (visible && postId) setActiveId(postId);
    }, [visible, postId]);

    const { comments, loading, refreshing, error, refresh, reload, add, removeLocal, patch } = useComments(
        activeId,
        currentUser._id
    );

    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const listRef = useRef<FlatList<Thread>>(null);

    useEffect(() => {
        setReplyTo(null);
        setExpanded({});
    }, [activeId]);

    /* ----- sheet animation ----- */
    useEffect(() => {
        if (visible) setMounted(true);
        else Keyboard.dismiss();
    }, [visible]);

    useEffect(() => {
        if (visible && mounted) {
            Animated.timing(progress, {
                toValue: 1,
                duration: 320,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        } else if (!visible && mounted) {
            Animated.timing(progress, {
                toValue: 0,
                duration: 240,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start(({ finished }) => {
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

    /* ----- actions ----- */
    const handleSubmit = useCallback(
        async (draft: Draft) => {
            if (!activeId) return 'Something went wrong';
            try {
                const parentId = replyTo ? replyTo.parentId ?? replyTo._id : null;
                const created = await createComment(activeId, draft, parentId, currentUser);
                add(created);
                onCountChange?.(activeId, 1);
                if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
                else listRef.current?.scrollToOffset({ offset: 0, animated: true });
                setReplyTo(null);
                return null;
            } catch (e) {
                return errMsg(e, 'Could not post comment');
            }
        },
        [activeId, replyTo, currentUser, add, onCountChange]
    );

    const handleLike = useCallback(
        async (c: Comment) => {
            const liked = !c.liked;
            patch(c._id, { liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) });
            try {
                await toggleLikeApi(c._id);
            } catch {
                patch(c._id, { liked: c.liked, likeCount: c.likeCount });
            }
        },
        [patch]
    );

    const handleDelete = useCallback(
        async (c: Comment) => {
            const ok = await confirmAsync('Delete comment?', 'This can\'t be undone.', 'Delete');
            if (!ok || !activeId) return;
            const removed = 1 + comments.filter((x) => x.parentId === c._id).length;
            removeLocal(c._id);
            onCountChange?.(activeId, -removed);
            try {
                await deleteCommentApi(c._id);
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
                <View style={{ padding: 16, gap: 18 }}>
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
                keyExtractor={(t) => t.top._id}
                ItemSeparatorComponent={Separator}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#fff"
                        colors={[COLORS.accent]}
                        progressBackgroundColor={COLORS.surface}
                    />
                }
                renderItem={({ item, index }) => {
                    const open = !!expanded[item.top._id];
                    return (
                        <View>
                            <CommentItem
                                comment={item.top}
                                index={index}
                                isOwn={item.top.author._id === currentUser._id}
                                replyCount={item.replies.length}
                                repliesOpen={open}
                                onToggleReplies={() => setExpanded((e) => ({ ...e, [item.top._id]: !open }))}
                                onLike={handleLike}
                                onReply={setReplyTo}
                                onDelete={handleDelete}
                            />
                            {open && item.replies.length > 0 && (
                                <View style={{ marginLeft: 50, marginTop: 14, gap: 14 }}>
                                    {item.replies.map((r) => (
                                        <CommentItem
                                            key={r._id}
                                            comment={r}
                                            isReply
                                            isOwn={r.author._id === currentUser._id}
                                            onLike={handleLike}
                                            onReply={setReplyTo}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <FadeIn>
                        <GlassPanel radius={24} style={{ padding: 28, alignItems: 'center', gap: 10 }}>
                            <NeoView radius={26} style={{ width: 56, height: 56 }}>
                                <MessageCircle size={24} color={COLORS.muted} />
                            </NeoView>
                            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800' }}>No comments yet</Text>
                            <Text style={{ color: COLORS.muted, fontSize: 13 }}>Be the first to say something.</Text>
                        </GlassPanel>
                    </FadeIn>
                }
            />
        );
    };

    return (
        <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'black/10', opacity: backdropOpacity }]} />
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => (kbVisible ? Keyboard.dismiss() : onClose())}
                accessibilityLabel="Close comments"
            />

            <Animated.View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: kbAnim }}>
                <Animated.View style={[styles.sheet, { height: height * 0.88, transform: [{ translateY }] }]}>
                    <BlurView intensity={60} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,18,0.86)' }]} />

                    <View {...pan.panHandlers} style={styles.grabberArea}>
                        <View style={styles.grabber} />
                    </View>

                    <View style={styles.header}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800' }}>Comments</Text>
                            <NeoView pressed radius={999} contentStyle={{ paddingHorizontal: 10, paddingVertical: 3 }}>
                                <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '700' }}>{comments.length}</Text>
                            </NeoView>
                        </View>
                        <IconButton Icon={X} label="Close comments" onPress={onClose} size={40} />
                    </View>

                    <View style={{ flex: 1 }}>{renderBody()}</View>

                    <CommentComposer
                        replyingTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                        onSubmit={handleSubmit}
                        keyboardVisible={kbVisible}
                        bottomInset={insets.bottom}
                    />
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: {
        flexShrink: 1,
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 12,
    },
});