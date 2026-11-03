import * as ImagePicker from 'expo-image-picker';
import { ChevronUp } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    SharedValue, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path

export const GALLERY_HEADER_H = 60;
/** Critically damped + clamped: glides into place, zero bounce. */
export const SHEET_SPRING = { damping: 34, stiffness: 320, mass: 0.9, overshootClamping: true } as const;

type Props = {
    sheetY: SharedValue<number>;
    closedY: number;
    height: number;
    bottomInset: number;
    onPick: (m: PickedMedia) => void;
};

/**
 * Pulling the sheet up opens the phone's own photo/video picker.
 * No custom grid, no library permission needed.
 */
export function GallerySheet({ sheetY, closedY, height, bottomInset, onPick }: Props) {
    const [resolving, setResolving] = useState(false);
    const busy = useRef(false);
    const startY = useSharedValue(0);

    const closeSheet = useCallback(() => {
        sheetY.value = withSpring(closedY, SHEET_SPRING);
    }, [sheetY, closedY]);

    const pickFromSystem = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        setResolving(true);
        try {
            const r = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: false,
                quality: 1,
            });
            if (r.canceled || !r.assets?.[0]) { closeSheet(); return; }
            const a = r.assets[0];
            const isVideo = a.type === 'video';
            const ext = (a.fileName?.split('.').pop() || a.uri.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
            onPick({
                kind: isVideo ? 'video' : 'image',
                uri: a.uri,
                name: a.fileName ?? `${isVideo ? 'video' : 'photo'}-${Date.now()}.${ext}`,
                mime: a.mimeType ?? (isVideo ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4') : ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg'),
                width: a.width, height: a.height,
                duration: a.duration ? a.duration / 1000 : undefined, // image-picker reports ms
            } as PickedMedia);
        } catch (e) {
            console.warn('system picker failed', e);
            closeSheet();
        } finally {
            busy.current = false;
            setResolving(false);
        }
    }, [onPick, closeSheet]);

    // open the system picker as soon as the sheet is pulled up
    useAnimatedReaction(
        () => sheetY.value < closedY * 0.6,
        (o, p) => { if (o && !p) runOnJS(pickFromSystem)(); },
    );

    const drag = Gesture.Pan()
        .onStart(() => { startY.value = sheetY.value; })
        .onUpdate((e) => { sheetY.value = Math.min(closedY, Math.max(0, startY.value + e.translationY)); })
        .onEnd((e) => {
            const goOpen = e.velocityY < -400 ? true : e.velocityY > 400 ? false : sheetY.value < closedY / 2;
            sheetY.value = withSpring(goOpen ? 0 : closedY, SHEET_SPRING);
        });
    const toggle = Gesture.Tap().onEnd(() => {
        sheetY.value = withSpring(sheetY.value > closedY / 2 ? 0 : closedY, SHEET_SPRING);
    });
    const headerGesture = Gesture.Race(drag, toggle);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
    const hintStyle = useAnimatedStyle(() => ({ opacity: interpolate(sheetY.value, [closedY * 0.75, closedY], [0, 1], 'clamp') }));

    return (
        <Animated.View style={[styles.sheet, { height }, sheetStyle]}>
            <GestureDetector gesture={headerGesture}>
                <View style={styles.header} collapsable={false}>
                    <View style={styles.pill} />
                    <Animated.View style={[styles.row, hintStyle]} pointerEvents="none">
                        <ChevronUp size={16} color="#fff" />
                        <Text style={styles.hint}>Gallery</Text>
                    </Animated.View>
                </View>
            </GestureDetector>

            <View style={[styles.empty, { paddingBottom: bottomInset + 24 }]}>
                <Text style={styles.emptyText}>Pick a photo or video from your phone</Text>
                <Pressable style={styles.cta} onPress={pickFromSystem}>
                    <Text style={styles.ctaText}>Open phone gallery</Text>
                </Pressable>
            </View>

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
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    emptyText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    cta: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
    ctaText: { fontWeight: '700' },
    loading: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});