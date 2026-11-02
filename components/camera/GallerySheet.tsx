import * as MediaLibrary from 'expo-media-library';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    SharedValue, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path

export const GALLERY_HEADER_H = 60;
const COLS = 4;
const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const Item = memo(function Item({ a, size, onPress }: { a: MediaLibrary.Asset; size: number; onPress: (a: MediaLibrary.Asset) => void }) {
    return (
        <Pressable onPress={() => onPress(a)} style={{ width: size, height: size, padding: 1 }}>
            <Image source={{ uri: a.uri }} style={{ flex: 1, backgroundColor: '#1B1B22' }} />
            {a.mediaType === 'video' && (
                <View style={styles.badge}><Text style={styles.badgeText}>{fmt(a.duration)}</Text></View>
            )}
        </Pressable>
    );
});

type Props = {
    sheetY: SharedValue<number>;
    closedY: number;
    height: number;
    bottomInset: number;
    onPick: (m: PickedMedia) => void;
};

export function GallerySheet({ sheetY, closedY, height, bottomInset, onPick }: Props) {
    const { width: W } = useWindowDimensions();
    const size = Math.floor(W / COLS);
    const [perm, requestPerm] = MediaLibrary.usePermissions();
    const [open, setOpen] = useState(false);
    const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
    const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
    const [album, setAlbum] = useState<MediaLibrary.Album | null>(null);
    const [albumsOpen, setAlbumsOpen] = useState(false);
    const [resolving, setResolving] = useState(false);
    const cursor = useRef<string | undefined>(undefined);
    const hasMore = useRef(true);
    const loading = useRef(false);
    const reqId = useRef(0);
    const startY = useSharedValue(0);

    useAnimatedReaction(
        () => sheetY.value < closedY * 0.6,
        (o, p) => { if (o !== p) runOnJS(setOpen)(o); },
        [closedY],
    );

    // ask for library access the first time the sheet is pulled up
    useEffect(() => {
        if (open && perm && !perm.granted && perm.canAskAgain) requestPerm();
    }, [open, perm, requestPerm]);

    const load = useCallback(async (reset: boolean) => {
        if (!reset && (loading.current || !hasMore.current)) return;
        loading.current = true;
        const id = ++reqId.current;
        try {
            const page = await MediaLibrary.getAssetsAsync({
                first: 60,
                after: reset ? undefined : cursor.current,
                album: album ?? undefined,
                mediaType: ['photo', 'video'],
                sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            });
            if (id !== reqId.current) return;
            cursor.current = page.endCursor;
            hasMore.current = page.hasNextPage;
            setAssets((p) => (reset ? page.assets : [...p, ...page.assets]));
        } catch (e) {
            console.warn('gallery load failed', e);
        } finally {
            if (id === reqId.current) loading.current = false;
        }
    }, [album]);

    useEffect(() => { if (perm?.granted) { hasMore.current = true; load(true); } }, [perm?.granted, album, load]);

    useEffect(() => {
        if (!perm?.granted) return;
        MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
            .then((a) => setAlbums(a.filter((x) => x.assetCount > 0).sort((x, y) => y.assetCount - x.assetCount)))
            .catch(() => { });
    }, [perm?.granted]);

    const pick = useCallback(async (a: MediaLibrary.Asset) => {
        setResolving(true);
        try {
            const info = await MediaLibrary.getAssetInfoAsync(a.id, { shouldDownloadFromNetwork: true });
            const uri = info.localUri ?? a.uri;
            const ext = (a.filename.split('.').pop() || '').toLowerCase();
            const isVideo = a.mediaType === 'video';
            onPick({
                kind: isVideo ? 'video' : 'image', uri, name: a.filename,
                mime: isVideo ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4') : (ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg'),
                width: a.width, height: a.height, duration: a.duration,
            } as PickedMedia);
        } finally { setResolving(false); }
    }, [onPick]);

    const drag = Gesture.Pan()
        .onStart(() => { startY.value = sheetY.value; })
        .onUpdate((e) => { sheetY.value = Math.min(closedY, Math.max(0, startY.value + e.translationY)); })
        .onEnd((e) => {
            const goOpen = e.velocityY < -400 ? true : e.velocityY > 400 ? false : sheetY.value < closedY / 2;
            sheetY.value = withSpring(goOpen ? 0 : closedY, { damping: 22, stiffness: 220, velocity: e.velocityY });
        });
    const toggle = Gesture.Tap().onEnd(() => {
        sheetY.value = withSpring(sheetY.value > closedY / 2 ? 0 : closedY, { damping: 22, stiffness: 220 });
    });
    const headerGesture = Gesture.Race(drag, toggle);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
    const hintStyle = useAnimatedStyle(() => ({ opacity: interpolate(sheetY.value, [closedY * 0.75, closedY], [0, 1], 'clamp') }));
    const titleStyle = useAnimatedStyle(() => ({ opacity: interpolate(sheetY.value, [closedY * 0.75, closedY], [1, 0], 'clamp') }));

    return (
        <Animated.View style={[styles.sheet, { height }, sheetStyle]}>
            <GestureDetector gesture={headerGesture}>
                <View style={styles.header} collapsable={false}>
                    <View style={styles.pill} />
                    <Animated.View style={[styles.row, hintStyle]} pointerEvents="none">
                        <ChevronUp size={16} color="#fff" />
                        <Text style={styles.hint}>Gallery</Text>
                    </Animated.View>
                    <Animated.View style={[styles.row, titleStyle]} pointerEvents={open ? 'auto' : 'none'}>
                        <Pressable style={styles.row} onPress={() => setAlbumsOpen((v) => !v)} hitSlop={10}>
                            <Text style={styles.title}>{album?.title ?? 'Recents'}</Text>
                            <ChevronDown size={18} color="#fff" style={{ transform: [{ rotate: albumsOpen ? '180deg' : '0deg' }] }} />
                        </Pressable>
                    </Animated.View>
                </View>
            </GestureDetector>

            {perm && !perm.granted ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Allow photo access to pick from your gallery</Text>
                    <Pressable style={styles.cta} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())}>
                        <Text style={styles.ctaText}>{perm.canAskAgain ? 'Allow access' : 'Open settings'}</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={assets}
                    keyExtractor={(a) => a.id}
                    numColumns={COLS}
                    renderItem={({ item }) => <Item a={item} size={size} onPress={pick} />}
                    onEndReached={() => load(false)}
                    onEndReachedThreshold={0.6}
                    initialNumToRender={24}
                    windowSize={7}
                    removeClippedSubviews
                    contentContainerStyle={{ paddingBottom: bottomInset + 12 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {albumsOpen && (
                <View style={styles.albums}>
                    <FlatList
                        data={[null, ...albums]}
                        keyExtractor={(a) => a?.id ?? 'recents'}
                        renderItem={({ item }) => (
                            <Pressable style={styles.albumRow} onPress={() => { setAlbum(item); setAlbumsOpen(false); }}>
                                <Text style={styles.albumTitle}>{item?.title ?? 'Recents'}</Text>
                                <View style={styles.row}>
                                    {item && <Text style={styles.albumCount}>{item.assetCount}</Text>}
                                    {(item?.id ?? null) === (album?.id ?? null) && <Check size={16} color="#A99BFF" />}
                                </View>
                            </Pressable>
                        )}
                    />
                </View>
            )}

            {resolving && <View style={styles.loading}><ActivityIndicator color="#fff" /></View>}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#0B0B0F', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
    header: { height: GALLERY_HEADER_H, alignItems: 'center', justifyContent: 'center' },
    pill: { position: 'absolute', top: 8, width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'absolute', top: 24 },
    hint: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' },
    badge: { position: 'absolute', right: 5, bottom: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    emptyText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    cta: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
    ctaText: { fontWeight: '700' },
    albums: { position: 'absolute', top: GALLERY_HEADER_H, left: 0, right: 0, bottom: 0, backgroundColor: '#0B0B0F' },
    albumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
    albumTitle: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
    albumCount: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
    loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});