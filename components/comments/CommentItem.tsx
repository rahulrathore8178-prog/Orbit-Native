import { resolveImg } from '@/lib/utils';
import * as Haptics from 'expo-haptics';
import { Heart, Trash2 } from 'lucide-react-native';
import React, { memo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Comment, timeAgo } from '../services/comments/commentsApi';
import { COLORS } from '../ui/neo';
import { CommentMediaView } from './CommentMedia';
import { Avatar, FadeIn } from './CommentUI';

const RED = '#f87171';

function LikeButton({ liked, count, onPress, onAccent }: { liked: boolean; count: number; onPress: () => void; onAccent?: boolean }) {
    const scale = useRef(new Animated.Value(1)).current;
    const press = () => {
        Haptics.selectionAsync().catch(() => { });
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.45, duration: 110, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, bounciness: 12, useNativeDriver: true }),
        ]).start();
        onPress();
    };
    return (
        <Pressable onPress={press} hitSlop={10} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} style={styles.act}>
            <Animated.View style={{ transform: [{ scale }] }}>
                <Heart size={16} color={liked ? RED : COLORS.muted} fill={liked ? RED : 'none'} />
            </Animated.View>
            {count > 0 ? <Text style={[styles.actText, liked && { color: RED }]}>{count}</Text> : null}
        </Pressable>
    );
}

type Props = {
    comment: Comment;
    /** true = written by the signed-in user: shown on the right, like a sent message */
    isOwn: boolean;
    isReply?: boolean;
    index?: number;
    onLike: (c: Comment) => void;
    onReply: (c: Comment) => void;
    onDelete: (c: Comment) => void;
    onRetry: (c: Comment) => void;
    onDiscard: (c: Comment) => void;
    onOpenImage: (url: string) => void;
};

function CommentItemBase({ comment, isOwn, isReply = false, index = 0, onLike, onReply, onDelete, onRetry, onDiscard, onOpenImage }: Props) {
    const mine = isOwn;
    const sending = comment.status === 'sending';
    const failed = comment.status === 'failed';
    const media = comment.media;
    const hasText = !!comment.content || !!comment.replyTo;
    const align = mine ? 'flex-end' : 'flex-start';

    return (
        <FadeIn delay={Math.min(index, 6) * 35}>
            <View style={[styles.row, { justifyContent: align, opacity: sending ? 0.72 : 1 }]}>
                {!mine ? (
                    <Avatar uri={resolveImg(comment.author.profilePic)} name={comment.author.username} size={isReply ? 30 : 38} />
                ) : null}

                <View style={[styles.col, mine ? styles.colMine : styles.colTheirs, { alignItems: align }]}>
                    {!mine ? (
                        <View style={styles.meta}>
                            <Text numberOfLines={1} style={styles.name}>{comment.author.username}</Text>
                            <Text style={styles.time}>{timeAgo(comment.createdAt)}</Text>
                        </View>
                    ) : null}

                    {hasText ? (
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                            <Text selectable style={[styles.text, mine && styles.textMine]}>
                                {comment.replyTo ? (
                                    <Text style={mine ? styles.mentionMine : styles.mention}>@{comment.replyTo.username} </Text>
                                ) : null}
                                {comment.content}
                            </Text>
                        </View>
                    ) : null}

                    {media ? (
                        <View style={{ marginTop: hasText ? 6 : 0 }}>
                            <CommentMediaView
                                media={media}
                                seed={comment.key ?? comment._id}
                                uploading={sending && media.type === 'image'}
                                progress={comment.progress}
                                onOpenImage={onOpenImage}
                            />
                        </View>
                    ) : null}

                    {failed ? (
                        <View style={[styles.actions, { justifyContent: align }]}>
                            <Text style={{ color: RED, fontSize: 12, fontWeight: '700' }}>Couldn't send</Text>
                            <Pressable onPress={() => onRetry(comment)} hitSlop={8}><Text style={styles.retry}>Retry</Text></Pressable>
                            <Pressable onPress={() => onDiscard(comment)} hitSlop={8}><Text style={styles.actText}>Discard</Text></Pressable>
                        </View>
                    ) : (
                        <View style={[styles.actions, { justifyContent: align }]}>
                            {mine ? <Text style={styles.time}>{sending ? 'sending…' : timeAgo(comment.createdAt)}</Text> : null}
                            {!sending ? (
                                <>
                                    <LikeButton liked={comment.liked} count={comment.likeCount} onPress={() => onLike(comment)} />
                                    <Pressable onPress={() => onReply(comment)} hitSlop={10}>
                                        <Text style={styles.actText}>Reply</Text>
                                    </Pressable>
                                    {mine ? (
                                        <Pressable onPress={() => onDelete(comment)} hitSlop={10} accessibilityLabel="Delete comment">
                                            <Trash2 size={14} color={COLORS.muted} />
                                        </Pressable>
                                    ) : null}
                                </>
                            ) : null}
                        </View>
                    )}
                </View>
            </View>
        </FadeIn>
    );
}

export default memo(CommentItemBase);

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 10, width: '100%' },
    // Chat feel: a gutter on the opposite side so bubbles never span the full width.
    col: { flexShrink: 1 },
    colMine: { maxWidth: '82%' },
    colTheirs: { marginRight: 28 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, paddingLeft: 4 },
    name: { flexShrink: 1, color: COLORS.text, fontSize: 13, fontWeight: '800' },
    time: { color: COLORS.muted, fontSize: 11.5 },
    bubble: { maxWidth: '100%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
    bubbleTheirs: {
        borderTopLeftRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.11)',
    },
    bubbleMine: { borderTopRightRadius: 6, backgroundColor: COLORS.accent },
    text: { color: COLORS.text, fontSize: 14.5, lineHeight: 20 },
    textMine: { color: '#ffffff' },
    mention: { color: COLORS.accent, fontWeight: '700' },
    mentionMine: { color: '#ffffff', fontWeight: '800', textDecorationLine: 'underline' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 6, paddingHorizontal: 4 },
    act: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
    retry: { color: COLORS.accent, fontSize: 12, fontWeight: '800' },
});