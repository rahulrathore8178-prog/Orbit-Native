// import { router } from '@/.expo/types/router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics'; // optional: npx expo install expo-haptics
import {
    Alert,
    Animated,
    FlatList,
    Image,
    Platform,
    Pressable,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import SideDrawer, { DrawerItemKey } from '../../components/sideDrawer/sideDrawer';
import { API_URL, BASE_IMAGE_URL, getDisplayImageUrl, resolveImg } from '../utils';
import CreatePost from '@/components/posts/CreatePost';
import CommentsSheet from '@/components/comments/CommentsSheet';
import { useIsFocused } from '@react-navigation/native';
import OrbitLoader from '@/components/ui/OrbitLoader';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { GlassPanel } from '@/components/ui/neo';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import ShareModal from '@/components/posts/ShareModal';
import type { ShareTarget } from '@/components/posts/ShareModal';
import { MenuIcon } from 'lucide-react-native';
import { useCollapsibleTray } from '@/hooks/capsule/useCollapsibleTray';
import { Rect } from '@/constants/capsule/types';
import { useCapsules } from '@/hooks/capsule/useCapsules';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAPSULE } from '@/constants/capsule/constants';
import { CapsuleTray } from '@/components/capsule/CapsuleTray';
import { CapsuleViewer } from '@/components/capsule/CapsuleViewer';
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
    onClickShare?: (id: string) => void;
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
    onComment,
    onDelete,
    onAuthorPress,
    onClickShare,
    onPressComments,
    isVisible = false,
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
    const [isLiked, setIsLiked] = useState(isLikedByCurrentUser);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const providedRatio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : null;
    const activeRatio = providedRatio ?? measuredImageRatio ?? (hasVideo ? 9 / 16 : 4 / 5);
    const mediaHeightPx = mediaWidthPx / clampAspectRatio(activeRatio);


    const DOUBLE_TAP_DELAY = 250;

    function useDoubleTap(onSingle: () => void, onDouble: () => void) {
        const lastTap = useRef(0);
        const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

        useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

        return useCallback(() => {
            const now = Date.now();
            if (now - lastTap.current < DOUBLE_TAP_DELAY) {
                // second tap: cancel the pending single tap, run double tap
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

        const HeartBurst = (
            <View pointerEvents="none" style={{ ...StyleSheetAbsolute, alignItems: 'center', justifyContent: 'center' }}>
                <Reanimated.View style={{ opacity, transform: [{ scale }] }}>
                    <Ionicons name="heart" size={90} color="#fff"
                        style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 }} />
                </Reanimated.View>
            </View>
        );

        return { play, HeartBurst };
    }

    const StyleSheetAbsolute = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

    const { play: playHeart, HeartBurst } = useHeartBurst();

    // -- like animation -------------------------------------------------------
    const [liked, setLiked] = useState(isLikedByCurrentUser);
    const [likeCount, setLikeCount] = useState(likesCount);
    useEffect(() => setLiked(isLikedByCurrentUser), [isLikedByCurrentUser]);
    useEffect(() => setLikeCount(likesCount), [likesCount]);

    const heartScale = useRef(new Animated.Value(1)).current;

    const likeInFlight = useRef(false);

    const sendLike = useCallback(async (forceLike = false) => {
        if (likeInFlight.current) return;
        if (forceLike && liked) return;          // double tap never unlikes

        likeInFlight.current = true;
        const next = !liked;

        // update the UI instantly
        setLiked(next);
        setLikeCount((c) => c + (next ? 1 : -1));
        Animated.sequence([
            Animated.timing(heartScale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ]).start();

        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/community/posts/${id}/like`,
                {},
                { withCredentials: true, headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Error in handleLike:', error);
            // roll back if the server failed
            setLiked(!next);
            setLikeCount((c) => c + (next ? -1 : 1));
        } finally {
            likeInFlight.current = false;
        }
    }, [liked, id, heartScale]);

    // like button: toggles
    const onLikePress = useCallback(() => sendLike(false), [sendLike]);

    // double tap: heart animation always plays, like only if not liked yet
    const handleLike = useCallback(() => {
        playHeart();
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendLike(true);
    }, [playHeart, sendLike]);

    // -- video ----------------------------------------------------------------
    const [isVideoMuted, setIsVideoMuted] = useState(true);
    const videoPlayer = useVideoPlayer(videoUri ?? null, (player) => {
        player.loop = true;
        player.muted = true;
    });

    useEffect(() => {
        videoPlayer.muted = isVideoMuted;
    }, [isVideoMuted, videoPlayer]);


    const toggleVideoPlay = useCallback(() => {
        if (videoPlayer.playing) videoPlayer.pause();
        else videoPlayer.play();
    }, [videoPlayer]);

    // Video: single = play/pause, double = like
    const handleVideoTap = useDoubleTap(toggleVideoPlay, handleLike);
    // Image: single = nothing, double = like
    const handleImageTap = useDoubleTap(() => { }, handleLike);

    const isFocused = useIsFocused();

    // 1. Player setup (runs once per player)
    useEffect(() => {
        videoPlayer.loop = true;
    }, [videoPlayer]);

    // 2. Mute follows state
    useEffect(() => {
        videoPlayer.muted = isVideoMuted;
    }, [videoPlayer, isVideoMuted]);

    // 3. Keep useState in sync with the real player state
    useEffect(() => {
        setIsVideoPlaying(videoPlayer.playing); // initial value
        const sub = videoPlayer.addListener('playingChange', ({ isPlaying }) => {
            setIsVideoPlaying(isPlaying);
        });
        return () => sub.remove();
    }, [videoPlayer]);

    // 4. Autoplay when >= 70% visible, pause the moment it drops below
    useEffect(() => {
        if (isVisible && isFocused) videoPlayer.play();
        else videoPlayer.pause();
    }, [isVisible, isFocused, videoPlayer]);

    // 5. Pause on unmount
    useEffect(() => () => { videoPlayer.pause(); }, [videoPlayer]);


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

    const openProfile = useOpenProfile();

    const openAuthor = () => {
        if (!author.id) return;
        if (isOwn) router.navigate('/(tabs)/profile');
        else openProfile(author.id);
    };

    return (
        <GlassPanel
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
                        onPress={openAuthor}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${author.username}'s profile`}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <View style={{ marginRight: 12 }}>
                            {author.profilePic ? (
                                <Image
                                    source={{ uri: resolveImg(author.profilePic) }}
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
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                                {author.username}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>
                                {formatTimeAgo(createdAt)} ago
                            </Text>
                        </View>
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
                    < View style={{ width: mediaWidthPx, height: mediaHeightPx, alignSelf: 'center', borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' }}>
                        <VideoView player={videoPlayer} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />
                        <Pressable onPress={handleVideoTap} style={{ ...StyleSheetAbsolute, alignItems: 'center', justifyContent: 'center' }}>
                            {!isVideoPlaying && (
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
                                </View>
                            )}
                        </Pressable>
                        {HeartBurst}
                        <TouchableOpacity
                            onPress={() => setIsVideoMuted((m) => !m)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={isVideoMuted ? 'Unmute video' : 'Mute video'}
                            style={{
                                position: 'absolute',
                                bottom: 12,
                                right: 12,
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons name={isVideoMuted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
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
                    <Pressable
                        onPress={handleImageTap}
                        style={{ width: mediaWidthPx, height: mediaHeightPx, alignSelf: 'center', borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)' }}
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
                        {HeartBurst}
                    </Pressable>
                ) : (
                    <View
                        style={{
                            marginHorizontal: cardPadding,
                            paddingLeft: 14,
                            paddingVertical: 2,
                            borderLeftWidth: 2,
                            borderLeftColor: 'rgba(255,255,255,0.14)',
                        }}
                    >
                        <Text
                            selectable
                            style={{
                                color: 'rgba(255,255,255,0.96)',
                                fontSize: 17,
                                lineHeight: 26,
                                fontWeight: '400',
                                letterSpacing: 0.15,
                            }}
                        >
                            {content}
                        </Text>
                    </View>
                )
                }

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
                            <TouchableOpacity onPress={() => onClickShare?.(id)} style={{ paddingTop: 2 }}>
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
                            <Reanimated.View style={{ transform: [{ scale: heartScale }], marginRight: 6 }}>
                                <Ionicons
                                    name={liked ? 'heart' : 'heart-outline'}
                                    size={19}
                                    color={liked ? '#fb7185' : 'rgba(255,255,255,0.9)'}
                                />
                            </Reanimated.View>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5 }}>{formatCount(likeCount)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onPressComments}
                            activeOpacity={0.75}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.9)" style={{ marginRight: 6 }} />
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5 }}>{commentsCount}</Text>
                        </TouchableOpacity>

                        {!hasMedia && (
                            <TouchableOpacity onPress={() => onClickShare?.(id)} style={{ marginLeft: 'auto' }}>
                                <Ionicons name="paper-plane-outline" size={16} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </BlurView >
        </GlassPanel >
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
    onClickShare: () => { },
});

type StoredUser = {
    id?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    profilePic?: string;
    friends?: string[];
    orbitals?: string[];
};

const stripHost = (p?: string) => (p ? p.replace(/^https?:\/\/[^/]+/, '') : p);

// Normalises whatever your API returns into what ShareModal needs.
const toShareTarget = (u: any): ShareTarget => ({
    id: String(u?._id ?? u?.id),
    name: u?.name ?? u?.username ?? 'Unknown',
    username: u?.username,
    avatar: u?.profilePic ? resolveImg(u.profilePic) : undefined,
    memberCount: u?.memberCount ?? u?.members?.length,
});

const toList = (data: any, key: string): any[] =>
    Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];

export default function HomeScreen() {
    const [posts, setPosts] = useState<PostcardProps[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [visibleId, setVisibleId] = useState<string | null>(null);

    // share
    const [shareId, setShareId] = useState<string | null>(null);
    const [friends, setFriends] = useState<ShareTarget[]>([]);
    const [orbitals, setOrbitals] = useState<ShareTarget[]>([]);
    const shareTargetsLoaded = useRef(false);

    const { nextTab } = useTabNavigation();
    const swipe = useHorizontalSwipe({
        onSwipeRight: () => setDrawerOpen(true),
    });
    const TRAY_H = CAPSULE.TRAY_ITEM_H + 24;

    // inside the component:
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const capsules = useCapsules();
    // console.log('capsules', capsules);
    const [headerH, setHeaderH] = useState(insets.top + 80); // corrected by onLayout
    const [viewer, setViewer] = useState<{ userId: string; origin: Rect } | null>(null);
    const { onScroll, trayStyle } = useCollapsibleTray(TRAY_H);

    // refetch capsules when returning from the create screen (skips first focus)
    const firstFocus = useRef(true);
    useFocusEffect(
        useCallback(() => {
            if (firstFocus.current) firstFocus.current = false;
            else capsules.reload();
        }, [capsules.reload]), // eslint-disable-line react-hooks/exhaustive-deps
    );

    /* ------------------------------ share ------------------------------ */

    const loadShareTargets = useCallback(async () => {
        if (shareTargetsLoaded.current) return; // fetch once, reuse after
        const token = await AsyncStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // TODO: replace these two endpoints with your real ones
        const [f, o] = await Promise.allSettled([
            axios.get(`${API_URL}/api/social/friends`, { headers }),
            axios.get(`${API_URL}/api/orbital/all`, { headers }),
        ]);
        console.log('Share targets fetched:', { friends: f, orbitals: o });

        if (f.status === 'fulfilled') setFriends(toList(f.value.data, 'friends').map(toShareTarget));
        if (o.status === 'fulfilled') setOrbitals(toList(o.value.data, 'orbitals').map(toShareTarget));
        if (f.status === 'fulfilled' || o.status === 'fulfilled') shareTargetsLoaded.current = true;
    }, []);

    const handleShare = useCallback((id: string) => {
        console.log('share tapped', id);
        setShareId(id);
        loadShareTargets();
    }, [loadShareTargets]);

    const closeShare = useCallback(() => setShareId(null), []);

    /* ----------------------------- drawer ------------------------------ */

    const handleSelect = (key: DrawerItemKey) => {
        setDrawerOpen(false);
        if (key === 'orbitals') {
            // wait for the drawer's 240ms slide-out so the push doesn't collide with the Modal
            setTimeout(() => router.push('/orbital'), 260);
        }
    };

    /* ----------------------------- feed -------------------------------- */

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 70,
        minimumViewTime: 100,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        const first = viewableItems.find((v: any) => v.isViewable);
        setVisibleId(first?.item?.id ?? null);
    }).current;

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('user');
                if (!raw) return setCurrentUser(null);
                const user = JSON.parse(raw);
                setCurrentUser({ ...user, profilePic: stripHost(user?.profilePic) });
            } catch (error) {
                console.error('Unable to load current user:', error);
                setCurrentUser(null);
            }
        })();
    }, []);
    // console.log('Current user:', currentUser);
    const loadPosts = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/community/feed`, {
                withCredentials: true,
                headers: { Authorization: `Bearer ${token}` },
            });
            const responsePosts = Array.isArray(response.data) ? response.data : response.data?.posts;
            setPosts(Array.isArray(responsePosts) ? responsePosts.map(toPostcardProps) : []);
        } catch (error) {
            console.log('API_URL =', API_URL);
            if (axios.isAxiosError(error)) {
                console.log('feed failed', {
                    url: error.config?.url,
                    code: error.code,
                    message: error.message,
                    status: error.response?.status,
                });
            }
            setPosts([]);
        } finally {
            setLoading(false);
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

    const keyExtractor = useCallback((post: PostcardProps) => post.id, []);

    const renderItem = useCallback(
        ({ item }: { item: PostcardProps }) => (
            <Postcard
                {...item}
                isVisible={item.id === visibleId}
                onPressComments={() => setCommentsPostId(item.id)}
                onClickShare={handleShare}
            />
        ),
        [visibleId, handleShare],
    );

    /* ----------------------------- render ------------------------------ */

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }} {...swipe.panHandlers}>
            {/* feed: padding makes room for the header + tray; onScroll drives the tray */}
            <Reanimated.FlatList
                data={posts}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                extraData={visibleId}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={() => {
                    refreshPosts();
                    capsules.reload();
                }}
                progressViewOffset={headerH + TRAY_H}
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: headerH + TRAY_H + 12, paddingBottom: 12 }}
                ListEmptyComponent={
                    loading ? null : (
                        <Text style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 32 }}>
                            No posts yet.
                        </Text>
                    )
                }
            />

            {/* capsule tray: sits under the header, slides up behind it on scroll */}
            <Reanimated.View
                style={[
                    { position: 'absolute', top: headerH, left: 0, right: 0, height: TRAY_H, zIndex: 10, elevation: 10 },
                    trayStyle,
                ]}
            >
                <GlassPanel edge="bottom" intensity={55} style={{ flex: 1, paddingTop: 12 }}>
                    <CapsuleTray
                        groups={capsules.groups}
                        currentUserId={capsules.me?.id}
                        onAdd={() => router.push('/capsule/create')}
                        onOpen={(userId, origin) => setViewer({ userId, origin })}
                    />
                </GlassPanel>
            </Reanimated.View>

            {/* header: always visible, above the tray */}
            <View
                onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, elevation: 20 }}
            >
                <GlassPanel edge="bottom" intensity={60} style={{ paddingTop: insets.top }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }}>
                        <Pressable
                            onPress={() => setDrawerOpen(true)}
                            hitSlop={8}
                            accessibilityLabel="Open menu"
                            style={{ width: 36 }}
                        >
                            <MenuIcon color="white" />
                        </Pressable>

                        <Pressable onPress={() => console.log('Orb8 pressed')} className="flex-1 mt-2 p-4">
                            <Text className="text-center text-2xl font-bold text-white">Orbit</Text>
                        </Pressable>

                        <View style={{ width: 36 }} />
                    </View>
                </GlassPanel>
            </View>

            <CreatePost
                user={{
                    username: currentUser?.username,
                    profilePic: resolveImg(currentUser?.profilePic),
                }}
                onPostCreated={(post, target) => {
                    if (target === 'feed') refreshPosts();
                }}
            />

            {/* overlays: all siblings, none of them take layout space */}
            <CommentsSheet
                visible={commentsPostId !== null}
                postId={commentsPostId}
                onClose={() => setCommentsPostId(null)}
                currentUser={{
                    id: currentUser?.id,
                    username: currentUser?.username,
                    profilePic: resolveImg(currentUser?.profilePic),
                }}
                onCountChange={(postId, delta) => {
                    // update that post's comment count in your list or store
                }}
            />

            <ShareModal
                visible={shareId !== null}
                postId={shareId}
                friends={friends}
                orbitals={orbitals}
                onClose={closeShare}
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

            <OrbitLoader visible={loading} />
        </View>
    );
}
