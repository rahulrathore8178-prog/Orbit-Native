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
import { router, useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import ConfirmSheet from '../profile/ConfirmSheet';

/* ------------------------------ types --------------------------------- */

export type SharedPostcardProps = Omit<PostcardProps, 'onPressComments' | 'onClickShare'> & {
    /** Trash button. Pass true only for the owner's posts on their own profile. */
    showDelete?: boolean;
    /** Don't navigate when the header is tapped (e.g. you're already on that profile). */
    disableAuthorPress?: boolean;
    /** Both receive the post id, so the parent can pass one stable handler for every card. */
    onPressComments?: (id: string) => void;
    onClickShare?: (id: string) => void;
};

/* ------------------------------ constants ----------------------------- */

const CARD_MARGIN = 12;
const CARD_PADDING = 14; // keep in sync with the px-3.5 / mx-3.5 classes below
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
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
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
        className="items-center justify-center border border-white/35 bg-white/15"
        style={{ width: size, height: size, borderRadius: size / 2 }}
    >
        <Text className="font-bold text-white" style={{ fontSize: size * 0.38 }}>
            {name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
    </View>
);

// orbital photos are absolute urls (Drive) or server paths; phones can't reach localhost
const orbitalImageUri = (u?: string) =>
    u ? (u.startsWith('/') ? `${API_URL}${u}` : u.replace(/^https?:\/\/localhost:5000/, API_URL)) : undefined;

const PostHeader = ({
    author,
    orbital,
    onOpenOrbital,
    createdAt,
    showDelete,
    disableAuthorPress,
    onOpenAuthor,
    onDelete,
}: {
    author: PostAuthor;
    orbital?: PostcardProps['orbital'];
    onOpenOrbital?: () => void;
    createdAt: PostcardProps['createdAt'];
    showDelete?: boolean;
    disableAuthorPress?: boolean;
    onOpenAuthor: () => void;
    onDelete: () => void;
}) => orbital?.name ? (
    // Orbital post: the orbital (photo + name) comes first, the person who posted it is nested under it.
    <View className="px-3.5 pb-3 pt-4">
        <View className="flex-row items-center">
            <TouchableOpacity
                activeOpacity={0.75}
                disabled={!orbital.id}
                onPress={onOpenOrbital}
                accessibilityRole="button"
                accessibilityLabel={`Open ${orbital.name} orbital`}
                className="flex-1 flex-row items-center"
            >
                <View className="mr-3">
                    {orbitalImageUri(orbital.image) ? (
                        <Image
                            source={{ uri: orbitalImageUri(orbital.image) }}
                            className="h-9 w-9 rounded-full border-[1.5px] border-white/50"
                        />
                    ) : (
                        <AvatarInitial name={orbital.name} size={36} />
                    )}
                </View>
                <View className="flex-1">
                    <Text numberOfLines={1} className="text-sm font-bold text-white">{orbital.name}</Text>
                    <Text className="mt-px text-[11px] text-white/65">Orbital</Text>
                </View>
            </TouchableOpacity>

            {showDelete && (
                <TouchableOpacity
                    onPress={onDelete}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Delete post"
                    className="p-1"
                >
                    <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            )}
        </View>

        <TouchableOpacity
            activeOpacity={0.75}
            disabled={disableAuthorPress}
            onPress={onOpenAuthor}
            accessibilityRole="button"
            accessibilityLabel={`Open ${author.username}'s profile`}
            className="ml-[17px] mt-2.5 flex-row items-center self-start border-l border-white/20 pl-5"
        >
            {author.profilePic ? (
                <Image source={{ uri: author.profilePic }} className="h-6 w-6 rounded-full border border-white/40" />
            ) : (
                <AvatarInitial name={author.username} size={24} />
            )}
            <Text numberOfLines={1} className="ml-2 text-[13px] font-semibold text-white/90">{author.username}</Text>
            <Text className="ml-2 text-[11px] text-white/55">{formatTimeAgo(createdAt)} ago</Text>
        </TouchableOpacity>
    </View>
) : (
    <View className="flex-row items-center px-3.5 pb-3 pt-4">
        <TouchableOpacity
            activeOpacity={0.75}
            disabled={disableAuthorPress}
            onPress={onOpenAuthor}
            accessibilityRole="button"
            accessibilityLabel={`Open ${author.username}'s profile`}
            className="flex-1 flex-row items-center"
        >
            <View className="mr-3">
                {author.profilePic ? (
                    <Image
                        source={{ uri: author.profilePic }}
                        className="h-9 w-9 rounded-full border-[1.5px] border-white/50"
                    />
                ) : (
                    <AvatarInitial name={author.username} size={36} />
                )}
            </View>
            <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-bold text-white">{author.username}</Text>
                <Text className="mt-px text-[11px] text-white/65">{formatTimeAgo(createdAt)} ago</Text>
            </View>
        </TouchableOpacity>

        {showDelete && (
            <TouchableOpacity
                onPress={onDelete}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Delete post"
                className="p-1"
            >
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
        <View className="self-center overflow-hidden rounded-[22px] bg-black" style={box}>
            <VideoView
                player={player}
                style={styles.fill}
                contentFit="contain"
                nativeControls={false}
                surfaceType="textureView"
            />
            <Pressable onPress={onTap} className="absolute inset-0 items-center justify-center">
                {!playing && (
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-black/40">
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
                className="absolute bottom-3 right-3 h-[34px] w-[34px] items-center justify-center rounded-full bg-black/50"
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
        <View className="mx-3.5 overflow-hidden rounded-[22px]">
            {coverUri ? (
                <Image
                    source={{ uri: coverUri }}
                    blurRadius={18}
                    className="absolute inset-0 h-full w-full opacity-70"
                />
            ) : (
                <LinearGradient colors={['#2a2f3a', '#12161d']} style={StyleSheet.absoluteFill} />
            )}
            <View className="absolute inset-0 bg-black/35" />

            <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity
                    onPress={toggle}
                    className="mr-3.5 h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/40"
                >
                    <Ionicons
                        name={playing ? 'pause' : 'play'}
                        size={18}
                        color="#fff"
                        style={playing ? undefined : { marginLeft: 2 }}
                    />
                </TouchableOpacity>

                <View className="flex-1">
                    <View className="h-9 flex-row items-center">
                        {waveform.map((h, i) => (
                            <View
                                key={i}
                                className="mr-0.5 w-[2.5px] rounded-sm"
                                style={{
                                    height: `${h * 100}%`,
                                    backgroundColor:
                                        (i / waveform.length) * 100 <= progress ? '#fff' : 'rgba(255,255,255,0.35)',
                                }}
                            />
                        ))}
                    </View>
                    <View className="mt-1.5 flex-row justify-between">
                        <Text className="text-[11px] text-white">{formatDuration(current)}</Text>
                        <Text className="text-[11px] text-white">{formatDuration(total)}</Text>
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
        <Pressable onPress={onTap} className="self-center overflow-hidden rounded-[22px] bg-black/30" style={box}>
            <Image
                source={{ uri }}
                blurRadius={22}
                resizeMode="cover"
                className="absolute inset-0 h-full w-full opacity-[0.55]"
                style={{ transform: [{ scale: 1.15 }] }}
            />
            <Image
                source={{ uri }}
                resizeMode="contain"
                onLoad={(e: any) => {
                    const { width, height } = e.nativeEvent?.source ?? {};
                    if (width && height) onRatio?.(width / height);
                }}
                className="absolute inset-0 h-full w-full"
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
    orbital,
    showDelete = false,
    disableAuthorPress = false,
    onDelete,
    onClickShare,
    onPressComments,
    isVisible = false,
}: SharedPostcardProps) => {
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
        if (disableAuthorPress || !author.id) return;
        if (isOwn) router.navigate('/(tabs)/profile');
        else openProfile(author.id);
    };

    const openOrbital = () => {
        if (orbital?.id) router.push({ pathname: '/orbital/[id]', params: { id: orbital.id } });
    };

    const [confirmOpen, setConfirmOpen] = useState(false);
    const confirmDelete = () => setConfirmOpen(true);

    const shareBtn = (
        <TouchableOpacity
            onPress={() => onClickShare?.(id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share post"
        >
            <Ionicons name="paper-plane-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
    );

    return (
        <GlassPanel style={{ width: cardWidth, alignSelf: 'center', marginBottom: 14, maxHeight: screenHeight * 0.78 }}>
            <BlurView intensity={75} tint="dark" style={styles.blur}>
                <PostHeader
                    author={author}
                    orbital={orbital}
                    onOpenOrbital={openOrbital}
                    createdAt={createdAt}
                    showDelete={showDelete}
                    disableAuthorPress={disableAuthorPress}
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
                    <View className="mx-3.5 border-l-2 border-white/15 py-0.5 pl-3.5">
                        <Text selectable className="text-[17px] font-normal leading-[26px] tracking-[0.15px] text-white/95">
                            {content}
                        </Text>
                    </View>
                )}

                {/* Footer */}
                <View className={`px-3.5 pb-4 ${hasMedia ? 'pt-3' : 'pt-4'}`}>
                    {hasMedia && content ? (
                        <View className="mb-2.5 flex-row items-start">
                            <Text numberOfLines={2} className="mr-2.5 flex-1 text-[13px] leading-[19px] text-white/95">
                                {content}
                            </Text>
                            {shareBtn}
                        </View>
                    ) : null}

                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={onLikePress} activeOpacity={0.75} className="mr-5 flex-row items-center">
                            <Animated.View style={{ transform: [{ scale: heartScale }], marginRight: 6 }}>
                                <Ionicons
                                    name={liked ? 'heart' : 'heart-outline'}
                                    size={20}
                                    color={liked ? '#fb7185' : ICON_COLOR}
                                />
                            </Animated.View>
                            <Text className="text-[12.5px] text-white/90">{formatCount(likeCount)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onPressComments?.(id)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Open comments"
                            className="mr-5 flex-row items-center"
                        >
                            <Ionicons name="chatbubble-outline" size={20} color={ICON_COLOR} style={{ marginRight: 6 }} />
                            <Text className="text-[12.5px] text-white/90">{commentsCount}</Text>
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

                        {!hasMedia && <View className="ml-auto">{shareBtn}</View>}
                    </View>
                </View>
            </BlurView>

            <ConfirmSheet
                visible={confirmOpen}
                title="Delete post?"
                message="This can't be undone."
                confirmText="Delete"
                destructive
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    onDelete?.(id);
                }}
            />
        </GlassPanel>
    );
};

export default memo(Postcard);

/* ------------------- styles (only for non-className components) ------------------- */

const styles = StyleSheet.create({
    fill: { width: '100%', height: '100%' },
    blur: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
});