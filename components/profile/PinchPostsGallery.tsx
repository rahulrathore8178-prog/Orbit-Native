import React, { memo, useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Archive, Pencil, Trash2 } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Postcard from '../postCard/PostCard';
import ActionSheet, { SheetAction } from '../ui/ActionSheet';
import ConfirmSheet from './ConfirmSheet';
import { API_URL, getDisplayImageUrl } from '../../lib/utils';
import { formatCount, withHost, type PostcardProps } from '../services/feed/postUtils';
import { useVideoThumb } from '@/hooks/sharedPost/useVideoThumb';

/* ------------------------------ config -------------------------------- */

const GRID_GAP = 10;
const TILE_RATIO = 1.32; // height / width
const PINCH_RANGE = 0.75; // |ln(scale)| that equals one full list <-> grid transition
const MAX_CAPTION = 2000;

type Mode = 'list' | 'grid';

type Props = {
    cards: PostcardProps[];
    /** Width of the container (same value you pass to Postcard as cardWidth). */
    width: number;
    isOwn: boolean;
    onDelete?: (id: string) => void;
    onArchive?: (id: string) => void | Promise<void>;
    onEditCaption?: (id: string, content: string) => Promise<void>;
    onPressComments?: (id: string) => void;
    onClickShare?: (id: string) => void;
};

/* ------------------------------- tile --------------------------------- */

const GridTile = memo(function GridTile({
    card,
    w,
    h,
    onOpen,
    onManage,
}: {
    card: PostcardProps;
    w: number;
    h: number;
    onOpen: (id: string) => void;
    onManage?: (id: string) => void;
}) {
    const scale = useSharedValue(1);
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const hasVideo = !!card.video;
    const hasVoice = !hasVideo && !!card.voiceNote;
    const imageUri = card.image
        ? card.image.startsWith('/')
            ? `${API_URL}${card.image}`
            : getDisplayImageUrl(card.image)
        : undefined;
    const videoThumb = useVideoThumb(card.id, hasVideo && !imageUri ? withHost(card.video) : undefined);
    const cover = imageUri ?? videoThumb;
    const showViews = w >= 140 && (card as any).views != null;

    return (
        <Animated.View style={[{ width: w, height: h, marginBottom: GRID_GAP }, pressStyle]}>
            <Pressable
                onPress={() => onOpen(card.id)}
                onLongPress={onManage ? () => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onManage(card.id);
                } : undefined}
                delayLongPress={350}
                onPressIn={() => { scale.value = withSpring(0.965, { damping: 18, stiffness: 320, mass: 0.6 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 320, mass: 0.6 }); }}
                style={styles.tile}
            >
                {cover ? (
                    <ExpoImage
                        source={{ uri: cover }}
                        contentFit="cover"
                        transition={200}
                        recyclingKey={card.id}
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <LinearGradient
                        colors={hasVideo || hasVoice ? ['#1B1830', '#0C0C11'] : ['#1d1d26', '#0C0C11']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}

                {!cover && (
                    <View className="flex-1 justify-center px-3.5 pb-12 pt-4">
                        {hasVideo || hasVoice ? (
                            <View className="items-center">
                                <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                                    <Ionicons name={hasVideo ? 'play' : 'mic'} size={20} color="rgba(255,255,255,0.9)" />
                                </View>
                            </View>
                        ) : (
                            <Text numberOfLines={7} className="text-[13.5px] font-medium leading-[19px] text-white/85">
                                {card.content}
                            </Text>
                        )}
                    </View>
                )}

                {hasVideo && (
                    <View className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-black/45">
                        <Ionicons name="play" size={11} color="#fff" style={{ marginLeft: 1 }} />
                    </View>
                )}
                {hasVoice && cover && (
                    <View className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-black/45">
                        <Ionicons name="mic" size={11} color="#fff" />
                    </View>
                )}

                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
                    style={styles.shade}
                    pointerEvents="none"
                />
                <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between px-3 pb-2.5">
                    <Stat icon="heart" value={card.likesCount ?? 0} />
                    <Stat icon="chatbubble" value={card.commentsCount ?? 0} />
                    {showViews && <Stat icon="eye" value={(card as any).views ?? 0} />}
                </View>
            </Pressable>
        </Animated.View>
    );
});

const Stat = ({ icon, value }: { icon: 'heart' | 'chatbubble' | 'eye'; value: number }) => (
    <View className="flex-row items-center">
        <Ionicons name={icon} size={12} color="rgba(255,255,255,0.88)" />
        <Text className="ml-1 text-[11px] font-semibold text-white/90">{formatCount(value)}</Text>
    </View>
);

/* ------------------------------ gallery ------------------------------- */

function PinchPostsGallery({
    cards,
    width,
    isOwn,
    onDelete,
    onArchive,
    onEditCaption,
    onPressComments,
    onClickShare,
}: Props) {
    const [mode, setMode] = useState<Mode>('list');
    const [busy, setBusy] = useState(false); // true while pinching / settling: both layers mounted

    const p = useSharedValue(0); // 0 = list, 1 = grid
    const base = useSharedValue(0);

    const settle = useCallback((target: number) => {
        const next: Mode = target === 1 ? 'grid' : 'list';
        setMode((prev) => {
            if (prev !== next && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            return next;
        });
        setBusy(false);
    }, []);

    // Two-finger pinch measured by hand (distance between the two touches), so it works at ANY
    // angle. It claims the touch stream only once a second finger lands, so one-finger scrolling
    // and the tab swipe are untouched, and the parent ScrollView can't steal a diagonal pinch.
    const active = useSharedValue(false);
    const startDist = useSharedValue(0);
    const vel = useSharedValue(0);

    const pinch = useMemo(() => {
        const finish = (manager: { end: () => void }) => {
            'worklet';
            if (!active.value) return;
            active.value = false;
            const target = p.value + vel.value * 6 > 0.5 ? 1 : 0; // flick bias
            p.value = withTiming(
                target,
                { duration: 240, easing: Easing.out(Easing.cubic) },
                (finished) => {
                    if (finished) runOnJS(settle)(target);
                },
            );
            manager.end();
        };

        return Gesture.Manual()
            .onTouchesDown((e, manager) => {
                if (e.numberOfTouches === 1) manager.begin();
                if (e.numberOfTouches === 2 && !active.value) {
                    const [a, b] = e.allTouches;
                    startDist.value = Math.hypot(a.x - b.x, a.y - b.y);
                    if (startDist.value < 8) return; // fingers practically on top of each other
                    base.value = p.value;
                    vel.value = 0;
                    active.value = true;
                    manager.activate();
                    runOnJS(setBusy)(true);
                }
            })
            .onTouchesMove((e) => {
                if (!active.value || e.numberOfTouches < 2) return;
                const [a, b] = e.allTouches;
                const scale = Math.hypot(a.x - b.x, a.y - b.y) / startDist.value;
                const next = Math.min(1, Math.max(0, base.value - Math.log(Math.max(scale, 0.01)) / PINCH_RANGE));
                vel.value = next - p.value;
                p.value = next;
            })
            .onTouchesUp((_e, manager) => finish(manager))
            .onTouchesCancelled((_e, manager) => finish(manager));
    }, [p, base, active, startDist, vel, settle]);

    const listStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    }));
    const gridStyle = useAnimatedStyle(
        () =>
            ({
                opacity: interpolate(p.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
                transform: [{ scale: interpolate(p.value, [0, 1], [1.1, 1], Extrapolation.CLAMP) }],
                transformOrigin: 'top',
            }) as any,
    );

    /* ---- grid metrics ---- */
    const tileW = Math.floor((width - GRID_GAP) / 2);
    const tileH = Math.round(tileW * TILE_RATIO);

    /* ---- open / manage ---- */
    const openPost = useCallback((id: string) => {
        router.push({ pathname: '/profile/savedPosts/[postId]', params: { postId: id } } as any);
    }, []);

    const [optionsId, setOptionsId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [edit, setEdit] = useState<{ id: string; hasMedia: boolean } | null>(null);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openManage = useCallback((id: string) => setOptionsId(id), []);

    const startEdit = (id: string) => {
        const c = cards.find((x) => x.id === id);
        if (!c) return;
        setDraft(c.content ?? '');
        setError(null);
        setEdit({ id, hasMedia: Boolean(c.image || c.video || c.voiceNote) });
    };

    const saveEdit = async () => {
        if (!edit) return;
        const next = draft.trim();
        const current = (cards.find((x) => x.id === edit.id)?.content ?? '').trim();
        if (next === current) return setEdit(null);
        if (!next && !edit.hasMedia) return setError("A text post can't be empty.");
        setSaving(true);
        setError(null);
        try {
            await onEditCaption?.(edit.id, next);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEdit(null);
        } catch {
            setError("Couldn't save your changes. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const actions: SheetAction[] = optionsId
        ? [
            { label: 'Archive', Icon: Archive, onPress: () => { onArchive?.(optionsId); } },
            { label: 'Edit caption', Icon: Pencil, onPress: () => startEdit(optionsId) },
            { label: 'Delete', Icon: Trash2, onPress: () => setDeleteId(optionsId), destructive: true },
        ]
        : [];

    /* ---- layers ---- */
    const showList = mode === 'list' || busy;
    const showGrid = mode === 'grid' || busy;
    const overlay = { position: 'absolute' as const, top: 0, left: 0, right: 0 };

    return (
        <>
            <GestureDetector gesture={pinch}>
                <View collapsable={false} style={busy ? { overflow: 'hidden' } : undefined}>
                    {showList && (
                        <Animated.View
                            pointerEvents={mode === 'list' && !busy ? 'auto' : 'none'}
                            style={[mode === 'grid' ? overlay : null, listStyle]}
                        >
                            {cards.map((card) => (
                                <Postcard
                                    key={card.id}
                                    {...card}
                                    showViews
                                    isOwn={isOwn}
                                    cardWidth={width}
                                    manageable={isOwn}
                                    disableAuthorPress
                                    onArchive={onArchive}
                                    onEditCaption={onEditCaption}
                                    onDelete={onDelete}
                                    onPressComments={onPressComments}
                                    onClickShare={onClickShare}
                                    isVisible={mode === 'list' && !busy}
                                />
                            ))}
                        </Animated.View>
                    )}

                    {showGrid && (
                        <Animated.View
                            pointerEvents={mode === 'grid' && !busy ? 'auto' : 'none'}
                            style={[
                                mode === 'list' ? overlay : null,
                                { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
                                gridStyle,
                            ]}
                        >
                            {cards.map((card) => (
                                <GridTile
                                    key={card.id}
                                    card={card}
                                    w={tileW}
                                    h={tileH}
                                    onOpen={openPost}
                                    onManage={isOwn ? openManage : undefined}
                                />
                            ))}
                        </Animated.View>
                    )}
                </View>
            </GestureDetector>

            <ActionSheet visible={optionsId !== null} onClose={() => setOptionsId(null)} actions={actions} />

            <ConfirmSheet
                visible={deleteId !== null}
                title="Delete post?"
                message="This can't be undone."
                confirmText="Delete"
                destructive
                onCancel={() => setDeleteId(null)}
                onConfirm={() => {
                    const id = deleteId;
                    setDeleteId(null);
                    if (id) onDelete?.(id);
                }}
            />

            <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => !saving && setEdit(null)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1 items-center justify-center bg-black/70 px-5"
                >
                    <View className="w-full rounded-3xl border border-white/15 bg-[#14141b] p-4">
                        <Text className="mb-3 text-[15px] font-semibold text-white">Edit caption</Text>
                        <View className="rounded-2xl border border-white/20 bg-white/[0.06] px-3.5 py-2.5">
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                autoFocus
                                multiline
                                editable={!saving}
                                maxLength={MAX_CAPTION}
                                placeholder="Write a caption..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                selectionColor="#ffffff"
                                textAlignVertical="top"
                                className="max-h-48 min-h-[60px] p-0 text-[14px] leading-5 text-white"
                            />
                        </View>
                        {!!error && <Text className="mt-2 text-xs text-red-400">{error}</Text>}
                        <View className="mt-3 flex-row items-center">
                            <Text className="flex-1 text-[11px] text-white/40">{draft.length}/{MAX_CAPTION}</Text>
                            <Pressable
                                onPress={() => setEdit(null)}
                                disabled={saving}
                                className="mr-2 rounded-full border border-white/15 px-4 py-1.5"
                            >
                                <Text className="text-[13px] font-semibold text-white/80">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={saveEdit}
                                disabled={saving}
                                className="min-w-[64px] items-center rounded-full bg-white px-4 py-1.5"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Text className="text-[13px] font-bold text-black">Save</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

export default memo(PinchPostsGallery);

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: '#0D0D12',
    },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 },
});