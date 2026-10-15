import { resolveImg } from '@/lib/utils';
import { Heart, Trash2 } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { COLORS, GlassPanel } from '../ui/neo';
import { Comment, timeAgo } from './commentsApi';
import { Avatar, FadeIn, ImageViewer, VideoTap, VoicePlayer } from './CommentUI';

function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;

    const press = () => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.4, duration: 110, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, bounciness: 10, useNativeDriver: true }),
        ]).start();
        onPress();
    };

    return (
        <Pressable
            onPress={press}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
            <Animated.View style={{ transform: [{ scale }] }}>
                <Heart size={16} color={liked ? '#f87171' : COLORS.muted} fill={liked ? '#f87171' : 'none'} />
            </Animated.View>
            {count > 0 && (
                <Text style={{ color: liked ? '#f87171' : COLORS.muted, fontSize: 12, fontWeight: '700' }}>{count}</Text>
            )}
        </Pressable>
    );
}

type Props = {
    comment: Comment;
    isOwn: boolean;
    isReply?: boolean;
    index?: number;
    replyCount?: number;
    repliesOpen?: boolean;
    onToggleReplies?: () => void;
    onLike: (c: Comment) => void;
    onReply: (c: Comment) => void;
    onDelete: (c: Comment) => void;
};

export default function CommentItem({
    comment,
    isOwn,
    isReply = false,
    index = 0,
    replyCount = 0,
    repliesOpen = false,
    onToggleReplies,
    onLike,
    onReply,
    onDelete,
}: Props) {
    const [viewing, setViewing] = useState<string | null>(null);
    const media = comment.media;
    const actionText = { color: COLORS.muted, fontSize: 12, fontWeight: '700' as const };
    console.log('comment', comment)
    return (
        <FadeIn delay={Math.min(index, 6) * 40}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <Avatar uri={resolveImg(comment?.author?.profilePic)} name={comment.author.username} size={isReply ? 34 : 42} />

                <View style={{ flex: 1 }}>
                    <GlassPanel radius={18} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text numberOfLines={1} style={{ flexShrink: 1, color: COLORS.text, fontSize: 13, fontWeight: '800' }}>
                                {comment.author.username}
                            </Text>
                            <Text style={{ color: COLORS.muted, fontSize: 11 }}>{timeAgo(comment.createdAt)}</Text>
                        </View>

                        {!!comment.content && (
                            <Text selectable style={{ color: COLORS.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
                                {comment.content}
                            </Text>
                        )}

                        {media?.type === 'image' && (
                            <Pressable onPress={() => setViewing(media.url)} style={{ marginTop: 8 }}>
                                <Image
                                    source={{ uri: media.url }}
                                    style={{ width: '100%', height: 200, borderRadius: 14 }}
                                    resizeMode="cover"
                                />
                            </Pressable>
                        )}
                        {media?.type === 'gif' && (
                            <Image
                                source={{ uri: media.url }}
                                style={{ width: '100%', height: 170, borderRadius: 14, marginTop: 8 }}
                                resizeMode="cover"
                            />
                        )}
                        {media?.type === 'video' && <VideoTap uri={media.url} />}
                        {media?.type === 'audio' && <VoicePlayer uri={media.url} duration={media.duration} />}
                    </GlassPanel>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 8, paddingTop: 8 }}>
                        <LikeButton liked={comment.liked} count={comment.likeCount} onPress={() => onLike(comment)} />
                        <Pressable onPress={() => onReply(comment)} hitSlop={8}>
                            <Text style={actionText}>Reply</Text>
                        </Pressable>
                        {isOwn && (
                            <Pressable onPress={() => onDelete(comment)} hitSlop={8} accessibilityLabel="Delete comment">
                                <Trash2 size={14} color={COLORS.muted} />
                            </Pressable>
                        )}
                        {replyCount > 0 && onToggleReplies && (
                            <Pressable onPress={onToggleReplies} hitSlop={8}>
                                <Text style={actionText}>
                                    {repliesOpen ? 'Hide replies' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>

            <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
        </FadeIn>
    );
}