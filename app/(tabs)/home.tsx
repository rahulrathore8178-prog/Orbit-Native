import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Image,
    Pressable,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { API_URL, BASE_IMAGE_URL, getDisplayImageUrl } from '../utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostAuthor {
    id?: string;
    username: string;
    profilePic?: string;
}

export interface PostcardProps {
    id: string;
    author: PostAuthor;
    createdAt: string | number | Date;
    content?: string;
    image?: string;
    video?: string;
    voiceNote?: string;
    voiceNoteDuration?: number;
    /** Optional media dimensions from your backend (recommended for video). */
    mediaWidth?: number;
    mediaHeight?: number;
    likesCount: number;
    commentsCount: number;
    isLikedByCurrentUser: boolean;
    isOwn?: boolean;
    handleLike: (id: string, nextLiked: boolean) => void;
    onComment?: (id: string) => void;
    onDelete?: (id: string) => void;
    onAuthorPress?: (authorId: string) => void;
    onShare?: (id: string) => void;
    /** Pass this from a FlatList viewabilityConfig to auto-pause off-screen media. */
    isVisible?: boolean;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const resolveMediaUri = (path?: string): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    return `${BASE_IMAGE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const formatTimeAgo = (createdAt: string | number | Date): string => {
    const then = new Date(createdAt).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.floor(days / 365)}y`;
};

const formatCount = (count: number): string => {
    if (count < 1000) return `${count}`;
    if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0)}k`;
    return `${(count / 1_000_000).toFixed(1)}M`;
};

const formatDuration = (seconds?: number): string => {
    const total = Math.max(0, Math.floor(seconds ?? 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const hashSeed = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const seededRandom = (seed: number) => {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
};

const buildWaveform = (seed: number, bars = 40): number[] => {
    const rand = seededRandom(seed || 1);
    return Array.from({ length: bars }, () => 0.25 + rand() * 0.75);
};

// A small rotating set of glass-tinted gradients, picked per post so the
// feed doesn't look monotone. Feel free to swap these for your brand colors.
const GRADIENTS: [string, string][] = [
    ['#6D5BFF', '#FF6FD8'],
    ['#00C6FB', '#005BEA'],
    ['#FF9A8B', '#FF6A88'],
    ['#43E97B', '#38F9D7'],
    ['#FDC830', '#F37335'],
    ['#A18CD1', '#FBC2EB'],
];

const pickGradient = (seed: string): [string, string] => GRADIENTS[hashSeed(seed) % GRADIENTS.length];

// Feed cards read best between a tall 4:5 portrait and a wide 1.91:1
// landscape, matching the clamp most social apps use so no single post can
// dominate or shrink the scroll. Ratio is width / height.
const MIN_ASPECT_RATIO = 4 / 5;
const MAX_ASPECT_RATIO = 1.91;
const clampAspectRatio = (ratio: number): number =>
    Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    isOwn,
    handleLike,
    onComment,
    onDelete,
    onAuthorPress,
    onShare,
    isVisible = true,
}: PostcardProps) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const imageUri = image?.startsWith('/') ? `${API_URL}${image}` : getDisplayImageUrl(image);
    const videoUri = video?.startsWith('/') ? `${API_URL}${video}` : video;
    const audioUri = voiceNote?.startsWith('/') ? `${API_URL}${voiceNote}` : voiceNote;
    // const videoUri = useMemo(() => resolveMediaUri(video), [video]);
    // const audioUri = useMemo(() => resolveMediaUri(audio), [audio]);

    const hasVideo = Boolean(videoUri);
    const hasAudio = Boolean(audioUri) && !hasVideo;
    const hasImage = Boolean(imageUri) && !hasVideo && !hasAudio;
    const hasMedia = hasVideo || hasAudio || hasImage;

    // -- layout -------------------------------------------------------------
    const cardMargin = 12;
    const cardPadding = 14;
    const cardWidth = screenWidth - cardMargin * 2;
    const mediaWidthPx = cardWidth - cardPadding * 2;
    const cardMaxHeight = screenHeight * 0.78;

    const [measuredImageRatio, setMeasuredImageRatio] = useState<number | null>(null);
    const providedRatio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : null;
    const activeRatio = providedRatio ?? measuredImageRatio ?? (hasVideo ? 9 / 16 : 4 / 5);
    const mediaHeightPx = mediaWidthPx / clampAspectRatio(activeRatio);

    // -- like animation -------------------------------------------------------
    const [liked, setLiked] = useState(isLikedByCurrentUser);
    const [likeCount, setLikeCount] = useState(likesCount);
    useEffect(() => setLiked(isLikedByCurrentUser), [isLikedByCurrentUser]);
    useEffect(() => setLikeCount(likesCount), [likesCount]);

    const heartScale = useRef(new Animated.Value(1)).current;
    const onLikePress = () => {
        const next = !liked;
        setLiked(next);
        setLikeCount((c) => c + (next ? 1 : -1));
        Animated.sequence([
            Animated.timing(heartScale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ]).start();
        handleLike?.(id, next);
    };

    // -- video ----------------------------------------------------------------
    const [isVideoMuted, setIsVideoMuted] = useState(true);
    const videoPlayer = useVideoPlayer(videoUri ?? null, (player) => {
        player.loop = true;
        player.muted = true;
    });
    const { isPlaying: isVideoPlaying } = useEvent(videoPlayer, 'playingChange', {
        isPlaying: videoPlayer.playing,
    });

    useEffect(() => {
        videoPlayer.muted = isVideoMuted;
    }, [isVideoMuted, videoPlayer]);

    const toggleVideoPlay = () => {
        if (isVideoPlaying) videoPlayer.pause();
        else videoPlayer.play();
    };

    // -- audio (voice note) ---------------------------------------------------
    const audioPlayer = useAudioPlayer(audioUri ?? null);
    const audioStatus = useAudioPlayerStatus(audioPlayer);
    const isAudioPlaying = Boolean(audioStatus?.playing);
    const audioDuration = audioStatus?.duration || voiceNoteDuration || 0;
    const audioCurrentTime = audioStatus?.currentTime || 0;
    const audioProgress = audioDuration > 0 ? Math.min(100, (audioCurrentTime / audioDuration) * 100) : 0;

    const toggleAudioPlay = () => {
        if (isAudioPlaying) {
            audioPlayer.pause();
        } else {
            if (audioStatus?.didJustFinish) audioPlayer.seekTo(0);
            audioPlayer.play();
        }
    };

    const waveform = useMemo(() => buildWaveform(hashSeed(id)), [id]);

    // -- pause offscreen media --------------------------------------------------
    useEffect(() => {
        if (!isVisible) {
            videoPlayer.pause();
            audioPlayer.pause();
        }
    }, [isVisible, videoPlayer, audioPlayer]);

    // -- text post styling ------------------------------------------------------
    const textLength = content?.length ?? 0;
    const textTypographyStyle =
        textLength <= 60
            ? { fontSize: 26, lineHeight: 34, fontWeight: '700' as const }
            : textLength <= 160
                ? { fontSize: 19, lineHeight: 27, fontWeight: '600' as const }
                : { fontSize: 15, lineHeight: 22, fontWeight: '500' as const };

    const [gradientFrom, gradientTo] = useMemo(() => pickGradient(id || author.username), [id, author.username]);

    const confirmDelete = () => {
        Alert.alert('Delete post?', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(id) },
        ]);
    };

    return (
        <View
            style={{ width: cardWidth, alignSelf: 'center', marginBottom: 14, maxHeight: cardMaxHeight }}>
            {/* Ambient glow behind the card */}
            {/* <LinearGradient
                colors={[`${gradientFrom}55`, `${gradientTo}00`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    position: 'absolute',
                    top: 14,
                    left: -14,
                    right: -14,
                    bottom: -14,
                    borderRadius: 40,
                    opacity: 0.7,
                }}
            /> */}

            <BlurView
                intensity={75}
                tint="dark"
                style={{
                    borderRadius: 28,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                }}
            >
                {/* top-left sheen */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.7, y: 0.7 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }}
                    pointerEvents="none"
                />

                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: cardPadding,
                        paddingTop: 16,
                        paddingBottom: 12,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => author.id && onAuthorPress?.(author.id)}
                        style={{ marginRight: 12 }}
                    >
                        {author.profilePic ? (
                            <Image
                                source={{ uri: author.profilePic }}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    borderWidth: 1.5,
                                    borderColor: 'rgba(255,255,255,0.5)',
                                }}
                            />
                        ) : (
                            <AvatarInitial name={author.username} size={36} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => author.id && onAuthorPress?.(author.id)}
                        style={{ flex: 1 }}
                    >
                        <Text
                            numberOfLines={1}
                            style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                        >
                            {author.username}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>
                            {formatTimeAgo(createdAt)} ago
                        </Text>
                    </TouchableOpacity>

                    {isOwn && (
                        <TouchableOpacity
                            onPress={confirmDelete}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ padding: 4 }}
                        >
                            <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Body */}
                {hasVideo ? (
                    <View
                        style={{
                            width: mediaWidthPx,
                            height: mediaHeightPx,
                            alignSelf: 'center',
                            borderRadius: 22,
                            overflow: 'hidden',
                            backgroundColor: '#000',
                        }}
                    >
                        <VideoView
                            player={videoPlayer}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="contain"
                            nativeControls={false}
                        />
                        <Pressable
                            onPress={toggleVideoPlay}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {!isVideoPlaying && (
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 28,
                                        backgroundColor: 'rgba(0,0,0,0.4)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
                                </View>
                            )}
                        </Pressable>
                        <TouchableOpacity
                            onPress={() => setIsVideoMuted((m) => !m)}
                            style={{
                                position: 'absolute',
                                bottom: 12,
                                right: 12,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: 'rgba(0,0,0,0.45)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons
                                name={isVideoMuted ? 'volume-mute' : 'volume-high'}
                                size={15}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>
                ) : hasAudio ? (
                    <View
                        style={{
                            marginHorizontal: cardPadding,
                            borderRadius: 22,
                            overflow: 'hidden',
                        }}
                    >
                        {imageUri ? (
                            <Image
                                source={{ uri: imageUri }}
                                blurRadius={18}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.7 }}
                            />
                        ) : (
                            <LinearGradient
                                colors={['#2a2f3a', '#12161d']}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            />
                        )}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
                            <TouchableOpacity
                                onPress={toggleAudioPlay}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.4)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}
                            >
                                <Ionicons
                                    name={isAudioPlaying ? 'pause' : 'play'}
                                    size={18}
                                    color="#fff"
                                    style={isAudioPlaying ? undefined : { marginLeft: 2 }}
                                />
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        height: 36,
                                    }}
                                >
                                    {waveform.map((h, i) => {
                                        const barProgress = (i / waveform.length) * 100;
                                        const isFilled = barProgress <= audioProgress;
                                        return (
                                            <View
                                                key={i}
                                                style={{
                                                    width: 2.5,
                                                    marginRight: 2,
                                                    borderRadius: 2,
                                                    height: `${h * 100}%`,
                                                    backgroundColor: isFilled ? '#fff' : 'rgba(255,255,255,0.35)',
                                                }}
                                            />
                                        );
                                    })}
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                    <Text style={{ color: '#fff', fontSize: 11 }}>{formatDuration(audioCurrentTime)}</Text>
                                    <Text style={{ color: '#fff', fontSize: 11 }}>{formatDuration(audioDuration)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : hasImage ? (
                    <View
                        style={{
                            width: mediaWidthPx,
                            height: mediaHeightPx,
                            alignSelf: 'center',
                            borderRadius: 22,
                            overflow: 'hidden',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                        }}
                    >
                        <Image
                            source={{ uri: imageUri }}
                            blurRadius={22}
                            resizeMode="cover"
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55, transform: [{ scale: 1.15 }] }}
                        />
                        <Image
                            source={{ uri: imageUri }}
                            resizeMode="contain"
                            onLoad={(e: any) => {
                                const { width, height } = e.nativeEvent?.source ?? {};
                                if (width && height && !providedRatio) {
                                    setMeasuredImageRatio(width / height);
                                }
                            }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                    </View>
                ) : (
                    <LinearGradient
                        colors={[gradientFrom, gradientTo]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            marginHorizontal: cardPadding,
                            borderRadius: 22,
                            paddingHorizontal: 18,
                            paddingVertical: 22,
                            maxHeight: cardMaxHeight * 0.55,
                        }}
                    >
                        <Text
                            style={{
                                color: '#fff',
                                ...textTypographyStyle,
                                textShadowColor: 'rgba(0,0,0,0.25)',
                                textShadowOffset: { width: 0, height: 2 },
                                textShadowRadius: 8,
                            }}
                        >
                            {content}
                        </Text>
                    </LinearGradient>
                )}

                {/* Footer */}
                <View style={{ paddingHorizontal: cardPadding, paddingTop: hasMedia ? 12 : 16, paddingBottom: 16 }}>
                    {hasMedia && content ? (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                            <Text
                                numberOfLines={2}
                                style={{ flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 13, lineHeight: 19, marginRight: 10 }}
                            >
                                {content}
                            </Text>
                            <TouchableOpacity onPress={() => onShare?.(id)} style={{ paddingTop: 2 }}>
                                <Ionicons name="paper-plane-outline" size={15} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={onLikePress}
                            activeOpacity={0.75}
                            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 22 }}
                        >
                            <Animated.View style={{ transform: [{ scale: heartScale }], marginRight: 6 }}>
                                <Ionicons
                                    name={liked ? 'heart' : 'heart-outline'}
                                    size={19}
                                    color={liked ? '#fb7185' : 'rgba(255,255,255,0.9)'}
                                />
                            </Animated.View>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5 }}>{formatCount(likeCount)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onComment?.(id)}
                            activeOpacity={0.75}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.9)" style={{ marginRight: 6 }} />
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5 }}>{commentsCount}</Text>
                        </TouchableOpacity>

                        {!hasMedia && (
                            <TouchableOpacity onPress={() => onShare?.(id)} style={{ marginLeft: 'auto' }}>
                                <Ionicons name="paper-plane-outline" size={16} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </BlurView>
        </View>
    );
};

type ApiPost = Partial<PostcardProps> & {
    _id?: string;
    user?: PostAuthor;
    author?: PostAuthor;
};

const toPostcardProps = (post: ApiPost): PostcardProps => ({
    id: post.id ?? post._id ?? `post-${Date.now()}`,
    author: post.author ?? post.user ?? { username: 'Unknown' },
    createdAt: post.createdAt ?? new Date().toISOString(),
    content: post.content ?? '',
    image: post.image,
    video: post.video,
    voiceNote: post.voiceNote,
    voiceNoteDuration: post.voiceNoteDuration,
    mediaWidth: post.mediaWidth,
    mediaHeight: post.mediaHeight,
    likesCount: post.likesCount ?? 0,
    commentsCount: post.commentsCount ?? 0,
    isLikedByCurrentUser: post.isLikedByCurrentUser ?? false,
    isOwn: post.isOwn,
    handleLike: () => { },
});

export default function HomeScreen() {
    const [posts, setPosts] = useState<PostcardProps[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadPosts = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/community/feed`, {
                withCredentials: true,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const responsePosts = Array.isArray(response.data) ? response.data : response.data?.posts;
            setPosts(Array.isArray(responsePosts) ? responsePosts.map(toPostcardProps) : []);
        } catch (error) {
            console.error('Error fetching feed posts:', error);
            setPosts([]);
        }
    };

    useEffect(() => {
        loadPosts();
    }, []);

    const refreshPosts = async () => {
        setRefreshing(true);
        await loadPosts();
        setRefreshing(false);
    };
    const pressed = () => {
        console.log('Orb8 pressed');
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Pressable
                onPress={pressed}
                className="mt-2 px-5 pb-4"
            >
                <Text className="text-center text-2xl font-bold text-white">
                    Orb8
                </Text>
            </Pressable>
            <FlatList
                data={posts}
                keyExtractor={(post) => post.id}
                renderItem={({ item }) => <Postcard {...item} />}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={refreshPosts}
                contentContainerStyle={{ paddingVertical: 12 }}
                ListEmptyComponent={
                    <Text style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 32 }}>
                        No posts yet.
                    </Text>
                }
            />
        </View>
    );
}