import { GlassPanel } from '@/components/ui/neo';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import {
    buildWaveform,
    clampAspectRatio,
    formatCount,
    formatDuration,
    formatTimeAgo,
    getAuthHeaders,
    hashSeed,
    withHost,
    type PostAuthor,
    type PostcardProps,
} from '../services/feed/postUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { API_URL, getDisplayImageUrl } from '../../lib/utils';

/* ------------------------------ constants ----------------------------- */

const CARD_MARGIN = 12;
const CARD_PADDING = 14;
const DOUBLE_TAP_DELAY = 250;
const ICON_COLOR = 'rgba(255,255,255,0.9)';
const SAVED_COLOR = '#F3E7D0'; // soft cream

const safe = (fn: () => void) => {
    try {
        fn();
    } catch {
        /* player already released */
    }
};

/* -------------------------------- hooks ------------------------------- */

function useDoubleTap(onSingle: () => void, onDouble: () => void) {
    const lastTap = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    return useCallback(() => {
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            if (timer.current) clearTimeout(timer.current);
            lastTap.current = 0;
            onDouble();
        } else {
            lastTap.current = now;
            timer.current = setTimeout(onSingle, DOUBLE_TAP_DELAY);
        }
    }, [onSingle, onDouble]);
}

function useHeartBurst() {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const play = useCallback(() => {
        scale.setValue(0.3);
        opacity.setValue(1);
        Animated.sequence([
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
            Animated.delay(250),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
    }, [scale, opacity]);

    const heart = (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
            <Animated.View style={{ opacity, transform: [{ scale }] }}>
                <Ionicons
                    name="heart"
                    size={90}
                    color="#fff"
                    style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 }}
                />
            </Animated.View>
        </View>
    );

    return { play, heart };
}

/* ----------------------------- small parts ---------------------------- */

const AvatarInitial = ({ name, size = 36 }: { name?: string; size?: number }) => (
    <View
        style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
            {name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
    </View>
);

const PostHeader = ({
    author,
    createdAt,
    isOwn,
    onOpenAuthor,
    onDelete,
}: {
    author: PostAuthor;
    createdAt: PostcardProps['createdAt'];
    isOwn?: boolean;
    onOpenAuthor: () => void;
    onDelete: () => void;
}) => (
    <View style={styles.header}>
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onOpenAuthor}
            accessibilityRole="button"
            accessibilityLabel={`Open ${author.username}'s profile`}
            style={styles.headerLeft}
        >
            <View style={{ marginRight: 12 }}>
                {author.profilePic ? (
                    <Image source={{ uri: author.profilePic }} style={styles.avatar} />
                ) : (
                    <AvatarInitial name={author.username} size={36} />
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.username}>{author.username}</Text>
                <Text style={styles.timeAgo}>{formatTimeAgo(createdAt)} ago</Text>
            </View>
        </TouchableOpacity>

        {isOwn && (
            <TouchableOpacity onPress={onDelete} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        )}
    </View>
);

/* ------------------------------- media -------------------------------- */

type MediaBox = { width: number; height: number };

const VideoMedia = ({
    uri,
    isVisible,
    box,
    onLike,
    heart,
}: {
    uri: string;
    isVisible: boolean;
    box: MediaBox;
    onLike: () => void;
    heart: React.ReactNode;
}) => {
    const isFocused = useIsFocused();
    const [muted, setMuted] = useState(true);
    const [playing, setPlaying] = useState(false);

    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
    });

    const togglePlay = useCallback(() => {
        safe(() => (player.playing ? player.pause() : player.play()));
    }, [player]);

    const onTap = useDoubleTap(togglePlay, onLike);

    useEffect(() => { safe(() => { player.muted = muted; }); }, [player, muted]);

    useEffect(() => {
        safe(() => setPlaying(player.playing));
        const sub = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
        return () => safe(() => sub.remove());
    }, [player]);

    // autoplay when visible + screen focused, pause the moment it isn't
    useEffect(() => {
        safe(() => (isVisible && isFocused ? player.play() : player.pause()));
    }, [isVisible, isFocused, player]);

    return (
        <View style={[styles.mediaBox, box, { backgroundColor: '#000' }]}>
            <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls={false} />
            <Pressable onPress={onTap} style={[StyleSheet.absoluteFill, styles.center]}>
                {!playing && (
                    <View style={styles.playBadge}>
                        <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
                    </View>
                )}
            </Pressable>
            {heart}
            <TouchableOpacity
                onPress={() => setMuted((m) => !m)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
                style={styles.muteBtn}
            >
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const AudioMedia = ({
    id,
    uri,
    coverUri,
    duration,
    isVisible,
}: {
    id: string;
    uri: string;
    coverUri?: string;
    duration?: number;
    isVisible: boolean;
}) => {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);
    const playing = Boolean(status?.playing);
    const total = status?.duration || duration || 0;
    const current = status?.currentTime || 0;
    const progress = total > 0 ? Math.min(100, (current / total) * 100) : 0;
    const waveform = useMemo(() => buildWaveform(hashSeed(id)), [id]);

    const toggle = () =>
        safe(() => {
            if (playing) return player.pause();
            if (status?.didJustFinish) player.seekTo(0);
            player.play();
        });

    useEffect(() => {
        if (!isVisible) safe(() => player.pause());
    }, [isVisible, player]);

    return (
        <View style={{ marginHorizontal: CARD_PADDING, borderRadius: 22, overflow: 'hidden' }}>
            {coverUri ? (
                <Image source={{ uri: coverUri }} blurRadius={18} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} />
            ) : (
                <LinearGradient colors={['#2a2f3a', '#12161d']} style={StyleSheet.absoluteFill} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />

            <View style={styles.audioRow}>
                <TouchableOpacity onPress={toggle} style={styles.audioBtn}>
                    <Ionicons
                        name={playing ? 'pause' : 'play'}
                        size={18}
                        color="#fff"
                        style={playing ? undefined : { marginLeft: 2 }}
                    />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 36 }}>
                        {waveform.map((h, i) => (
                            <View
                                key={i}
                                style={{
                                    width: 2.5,
                                    marginRight: 2,
                                    borderRadius: 2,
                                    height: `${h * 100}%`,
                                    backgroundColor: (i / waveform.length) * 100 <= progress ? '#fff' : 'rgba(255,255,255,0.35)',
                                }}
                            />
                        ))}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={styles.audioTime}>{formatDuration(current)}</Text>
                        <Text style={styles.audioTime}>{formatDuration(total)}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const ImageMedia = ({
    uri,
    box,
    onLike,
    onRatio,
    heart,
}: {
    uri: string;
    box: MediaBox;
    onLike: () => void;
    onRatio?: (ratio: number) => void;
    heart: React.ReactNode;
}) => {
    const onTap = useDoubleTap(() => { }, onLike);
    return (
        <Pressable onPress={onTap} style={[styles.mediaBox, box, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <Image
                source={{ uri }}
                blurRadius={22}
                resizeMode="cover"
                style={[StyleSheet.absoluteFill, { opacity: 0.55, transform: [{ scale: 1.15 }] }]}
            />
            <Image
                source={{ uri }}
                resizeMode="contain"
                onLoad={(e: any) => {
                    const { width, height } = e.nativeEvent?.source ?? {};
                    if (width && height) onRatio?.(width / height);
                }}
                style={StyleSheet.absoluteFill}
            />
            {heart}
        </Pressable>
    );
};

/* -------------------------------- card -------------------------------- */

const Postcard = ({
    id,
    author,
    createdAt,
    content,
    image,
    video,
    voiceNote,
    voiceNoteDuration,
    mediaWidth,
    mediaHeight,
    likesCount,
    commentsCount,
    isLikedByCurrentUser,
    isSaved = false,
    isOwn,
    onDelete,
    onClickShare,
    onPressComments,
    isVisible = false,
}: PostcardProps) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const imageUri = image?.startsWith('/') ? `${API_URL}${image}` : getDisplayImageUrl(image);
    const videoUri = withHost(video);
    const audioUri = withHost(voiceNote);

    const hasVideo = Boolean(videoUri);
    const hasAudio = Boolean(audioUri) && !hasVideo;
    const hasImage = Boolean(imageUri) && !hasVideo && !hasAudio;
    const hasMedia = hasVideo || hasAudio || hasImage;

    // layout
    const cardWidth = screenWidth - CARD_MARGIN * 2;
    const mediaWidthPx = cardWidth - CARD_PADDING * 2;
    const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
    const providedRatio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : null;
    const activeRatio = providedRatio ?? measuredRatio ?? (hasVideo ? 9 / 16 : 4 / 5);
    const box: MediaBox = { width: mediaWidthPx, height: mediaWidthPx / clampAspectRatio(activeRatio) };

    /* ---- like ---- */
    const [liked, setLiked] = useState(isLikedByCurrentUser);
    const [likeCount, setLikeCount] = useState(likesCount);
    useEffect(() => setLiked(isLikedByCurrentUser), [isLikedByCurrentUser]);
    useEffect(() => setLikeCount(likesCount), [likesCount]);

    const heartScale = useRef(new Animated.Value(1)).current;
    const likeInFlight = useRef(false);
    const { play: playHeart, heart } = useHeartBurst();

    const sendLike = useCallback(
        async (forceLike = false) => {
            if (likeInFlight.current) return;
            if (forceLike && liked) return; // double tap never unlikes

            likeInFlight.current = true;
            const next = !liked;
            setLiked(next);
            setLikeCount((c) => c + (next ? 1 : -1));
            Animated.sequence([
                Animated.timing(heartScale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
                Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
            ]).start();

            try {
                await axios.post(`${API_URL}/api/community/posts/${id}/like`, {}, {
                    withCredentials: true,
                    headers: await getAuthHeaders(),
                });
            } catch (error) {
                console.error('Like error:', error);
                setLiked(!next);
                setLikeCount((c) => c + (next ? -1 : 1));
            } finally {
                likeInFlight.current = false;
            }
        },
        [liked, id, heartScale],
    );

    const onLikePress = useCallback(() => sendLike(false), [sendLike]);
    const onDoubleTapLike = useCallback(() => {
        playHeart();
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendLike(true);
    }, [playHeart, sendLike]);

    /* ---- save (POST /saved/:postId to save, DELETE to unsave) ---- */
    const [saved, setSaved] = useState(isSaved);
    const saveInFlight = useRef(false);
    useEffect(() => setSaved(isSaved), [isSaved]);

    const toggleSaved = useCallback(async () => {
        if (saveInFlight.current) return;
        saveInFlight.current = true;
        const next = !saved;
        setSaved(next);
        if (Platform.OS !== 'web') Haptics.selectionAsync();

        try {
            await axios({
                method: next ? 'post' : 'delete',
                url: `${API_URL}/api/community/saved/${id}`,
                withCredentials: true,
                headers: await getAuthHeaders(),
            });
        } catch (error) {
            console.error('Save post error:', error);
            setSaved(!next);
        } finally {
            saveInFlight.current = false;
        }
    }, [saved, id]);

    /* ---- misc ---- */
    const openProfile = useOpenProfile();
    const openAuthor = () => {
        if (!author.id) return;
        if (isOwn) router.navigate('/(tabs)/profile');
        else openProfile(author.id);
    };

    const confirmDelete = () =>
        Alert.alert('Delete post?', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(id) },
        ]);

    const shareBtn = (
        <TouchableOpacity onPress={() => onClickShare?.(id)} hitSlop={8}>
            <Ionicons name="paper-plane-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
    );

    return (
        <GlassPanel style={{ width: cardWidth, alignSelf: 'center', marginBottom: 14, maxHeight: screenHeight * 0.78 }}>
            <BlurView intensity={75} tint="dark" style={styles.blur}>
                <PostHeader
                    author={author}
                    createdAt={createdAt}
                    isOwn={isOwn}
                    onOpenAuthor={openAuthor}
                    onDelete={confirmDelete}
                />

                {/* Body */}
                {hasVideo ? (
                    <VideoMedia uri={videoUri!} isVisible={isVisible} box={box} onLike={onDoubleTapLike} heart={heart} />
                ) : hasAudio ? (
                    <AudioMedia
                        id={id}
                        uri={audioUri!}
                        coverUri={imageUri}
                        duration={voiceNoteDuration}
                        isVisible={isVisible}
                    />
                ) : hasImage ? (
                    <ImageMedia
                        uri={imageUri!}
                        box={box}
                        onLike={onDoubleTapLike}
                        onRatio={providedRatio ? undefined : setMeasuredRatio}
                        heart={heart}
                    />
                ) : (
                    <View style={styles.textBody}>
                        <Text selectable style={styles.textContent}>{content}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: hasMedia ? 12 : 16, paddingBottom: 16 }}>
                    {hasMedia && content ? (
                        <View style={styles.caption}>
                            <Text numberOfLines={2} style={styles.captionText}>{content}</Text>
                            {shareBtn}
                        </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={onLikePress} activeOpacity={0.75} style={styles.action}>
                            <Animated.View style={{ transform: [{ scale: heartScale }], marginRight: 6 }}>
                                <Ionicons
                                    name={liked ? 'heart' : 'heart-outline'}
                                    size={20}
                                    color={liked ? '#fb7185' : ICON_COLOR}
                                />
                            </Animated.View>
                            <Text style={styles.count}>{formatCount(likeCount)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onPressComments} activeOpacity={0.75} style={styles.action}>
                            <Ionicons name="chatbubble-outline" size={20} color={ICON_COLOR} style={{ marginRight: 6 }} />
                            <Text style={styles.count}>{commentsCount}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={toggleSaved}
                            activeOpacity={0.75}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={saved ? 'Remove from saved posts' : 'Save post'}
                        >
                            <Ionicons
                                name={saved ? 'bookmark' : 'bookmark-outline'}
                                size={20}
                                color={saved ? SAVED_COLOR : ICON_COLOR}
                            />
                        </TouchableOpacity>

                        {!hasMedia && <View style={{ marginLeft: 'auto' }}>{shareBtn}</View>}
                    </View>
                </View>
            </BlurView>
        </GlassPanel>
    );
};

export default memo(Postcard);

/* ------------------------------- styles ------------------------------- */

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    fill: { width: '100%', height: '100%' },
    blur: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: CARD_PADDING,
        paddingTop: 16,
        paddingBottom: 12,
    },
    headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    username: { color: '#fff', fontSize: 14, fontWeight: '700' },
    timeAgo: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
    mediaBox: { alignSelf: 'center', borderRadius: 22, overflow: 'hidden' },
    playBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    muteBtn: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
    audioBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    audioTime: { color: '#fff', fontSize: 11 },
    textBody: {
        marginHorizontal: CARD_PADDING,
        paddingLeft: 14,
        paddingVertical: 2,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(255,255,255,0.14)',
    },
    textContent: {
        color: 'rgba(255,255,255,0.96)',
        fontSize: 17,
        lineHeight: 26,
        fontWeight: '400',
        letterSpacing: 0.15,
    },
    caption: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    captionText: { flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 13, lineHeight: 19, marginRight: 10 },
    action: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    count: { color: ICON_COLOR, fontSize: 12.5 },
});
