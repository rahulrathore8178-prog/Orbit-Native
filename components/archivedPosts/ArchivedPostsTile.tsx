import { memo, useCallback } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { cssInterop } from 'nativewind';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@/redux/store';
import { selectArchivedById, unarchivePost } from '@/redux/slice/archivedPosts/archivedPostsSlice';
import { API_URL, getDisplayImageUrl } from '@/lib/utils'; // ← keep the import paths you already use in Postcard
import { useVideoThumb } from '@/hooks/sharedPost/useVideoThumb';

cssInterop(ExpoImage, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

/* ───────────── Grid metrics (shared with skeleton) ───────────── */
export const GRID = { COLUMNS: 2, GAP: 12, PAD: 16 } as const;
export const tileSize = (screenWidth: number) => {
    const w = (screenWidth - GRID.PAD * 2 - GRID.GAP * (GRID.COLUMNS - 1)) / GRID.COLUMNS;
    return { w, h: Math.round(w * 1.3) };
};

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

const compact = (n: number) =>
    n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const withHost = (path?: string) => (path?.startsWith('/') ? `${API_URL}${path}` : path);

function ArchivedPostTile({ id, index }: { id: string; index: number }) {
    const item = useSelector(selectArchivedById(id));
    const dispatch = useDispatch<AppDispatch>();
    const { width } = useWindowDimensions();
    const { w, h } = tileSize(width);

    const scale = useSharedValue(1);
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    // Hooks must run before the early return below.
    const videoThumb = useVideoThumb(id, withHost(item?.card.video));

    const open = useCallback(
        () =>
            router.push({
                pathname: '/profile/savedPosts/archivedPosts/[postId]',
                params: { postId: id },
            }),
        [id],
    );

    const confirmUnarchive = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Remove from archive?', 'It will show on your profile again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unarchive', onPress: () => dispatch(unarchivePost(id)) },
        ]);
    }, [dispatch, id]);

    if (!item) return null;
    const { card } = item;

    const hasImage = !!card.image;
    const hasVideo = !hasImage && !!card.video;
    const hasVoice = !hasImage && !hasVideo && !!card.voiceNote;
    const imageUri = hasImage
        ? card.image!.startsWith('/')
            ? `${API_URL}${card.image}`
            : getDisplayImageUrl(card.image)
        : undefined;
    const coverUri = imageUri ?? videoThumb; // image, or the video's first frame
    const mediaBadge = card.video ? 'play' : card.voiceNote ? 'mic' : null;

    return (
        <Animated.View
            entering={index < 8 ? FadeInDown.delay(index * 45).springify().damping(20) : undefined}
            style={[{ width: w, height: h }, pressStyle]}
            className="rounded-[26px] bg-[#0D0D12] shadow-2xl shadow-black"
        >
            <Pressable
                onPress={open}
                onLongPress={confirmUnarchive}
                delayLongPress={380}
                onPressIn={() => (scale.value = withSpring(0.96, SPRING))}
                onPressOut={() => (scale.value = withSpring(1, SPRING))}
                className="flex-1 overflow-hidden rounded-[26px] border border-white/10"
            >
                {/* ── media ── */}
                {coverUri ? (
                    <ExpoImage
                        source={{ uri: coverUri }}
                        contentFit="cover"
                        transition={250}
                        recyclingKey={id}
                        className="absolute inset-0 bg-[#15151C]"
                    />
                ) : (
                    <LinearGradient
                        colors={hasVideo || hasVoice ? ['#1B1830', '#0C0C11'] : ['#181821', '#0C0C11']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="absolute inset-0"
                    />
                )}

                {/* centered play button over the video frame */}
                {hasVideo && videoThumb && (
                    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
                        <View className="h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/35">
                            <Ionicons name="play" size={22} color="#fff" />
                        </View>
                    </View>
                )}

                {/* text / video-loading / voice placeholder */}
                {!coverUri && (
                    <View className="flex-1 justify-center px-4 pb-14 pt-10">
                        {hasVideo || hasVoice ? (
                            <View className="items-center">
                                <View className="h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
                                    <Ionicons
                                        name={hasVideo ? 'play' : 'mic'}
                                        size={24}
                                        color="rgba(255,255,255,0.9)"
                                    />
                                </View>
                                {!!card.content && (
                                    <Text
                                        numberOfLines={3}
                                        className="mt-4 text-center text-[13px] leading-[19px] text-white/60"
                                    >
                                        {card.content}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <Text
                                numberOfLines={8}
                                className="text-[15px] font-medium leading-[22px] text-white/85"
                            >
                                {card.content}
                            </Text>
                        )}
                    </View>
                )}

                {/* ── type badge ── */}
                {mediaBadge && coverUri && !hasVideo && (
                    <View className="absolute right-2.5 top-2.5 h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40">
                        <Ionicons name={mediaBadge} size={13} color="#fff" />
                    </View>
                )}

                {/* ── author footer ── */}
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
                    className="absolute inset-x-0 bottom-0 h-24"
                    pointerEvents="none"
                />
                <View className="absolute inset-x-0 bottom-0 flex-row items-center px-3 pb-3">
                    {card.author?.profilePic ? (
                        <ExpoImage
                            source={{ uri: card.author.profilePic }}
                            contentFit="cover"
                            className="h-6 w-6 rounded-full border border-white/25 bg-[#1E1E27]"
                        />
                    ) : (
                        <View className="h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#23232D]">
                            <Text className="text-[10px] font-bold text-white">
                                {card.author?.username?.[0]?.toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <Text numberOfLines={1} className="ml-2 flex-1 text-[12px] font-semibold text-white">
                        {card.author?.username}
                    </Text>
                    <Ionicons name="heart" size={12} color="rgba(255,255,255,0.8)" />
                    <Text className="ml-1 text-[11px] font-medium text-white/80">
                        {compact(card.likesCount ?? 0)}
                    </Text>
                </View>
            </Pressable>
        </Animated.View>
    );
}

export default memo(ArchivedPostTile);