import * as ImageManipulator from 'expo-image-manipulator';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Check, Crop, FlipHorizontal, RotateCw, Undo2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trim } from 'react-native-video-trim';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path

const MAX_SEC = 60, MIN_SEC = 1, HANDLE = 18;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sizeOf = (uri: string) => new Promise<{ width: number; height: number }>((res, rej) => Image.getSize(uri, (width, height) => res({ width, height }), rej));

/** The ONLY place that touches the trim library. If its API differs in your installed version, fix it here. */
async function trimVideo(uri: string, startSec: number, endSec: number) {
    const r: any = await trim(uri, { startTime: Math.round(startSec * 1000), endTime: Math.round(endSec * 1000), saveToPhoto: false } as any);
    const out: string = r.outputPath ?? r.path ?? r;
    return out.startsWith('file://') ? out : `file://${out}`;
}

type EditorProps = {
    media: PickedMedia;
    onClose: () => void;
    /** Called when the user taps the tick (top-right) - move to the next step. */
    onSave: (m: PickedMedia) => void;
    /** Kept so existing callers still compile; no longer used (the tick button replaces the Proceed button). */
    confirmLabel?: string;
};
type Props = EditorProps & { visible: boolean };

/** Editor without a Modal, so it can be embedded (e.g. inside the camera). */
export function MediaEditor(props: EditorProps) {
    return (
        <View style={styles.editorRoot}>
            {props.media.kind === 'video' ? <VideoEditor {...props} /> : <ImageEditor {...props} />}
        </View>
    );
}

export function MediaViewer({ visible, ...rest }: Props) {
    return (
        <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={rest.onClose}>
            <GestureHandlerRootView style={styles.root}>
                <MediaEditor {...rest} />
            </GestureHandlerRootView>
        </Modal>
    );
}

/** Round white tick button for the top-right corner. */
const TickButton = ({ onPress, busy }: { onPress: () => void; busy?: boolean }) => (
    <Pressable
        onPress={onPress}
        disabled={busy}
        hitSlop={8}
        style={({ pressed }) => [styles.tick, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
    >
        {busy ? <ActivityIndicator color="#ffffff" /> : <Check size={25} color="#ffffff" strokeWidth={3} />}
    </Pressable>
);

/* ================= IMAGE ================= */
function ImageEditor({ media, onClose, onSave }: EditorProps) {
    const { width: W, height: H } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [uri, setUri] = useState(media.uri);
    const [history, setHistory] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [cropOpen, setCropOpen] = useState(false);
    const edited = history.length > 0;

    const scale = useSharedValue(1), savedScale = useSharedValue(1);
    const tx = useSharedValue(0), ty = useSharedValue(0), stx = useSharedValue(0), sty = useSharedValue(0);

    const resetZoom = useCallback(() => {
        scale.value = withTiming(1); savedScale.value = 1;
        tx.value = withTiming(0); ty.value = withTiming(0); stx.value = 0; sty.value = 0;
    }, [scale, savedScale, tx, ty, stx, sty]);
    useEffect(() => { resetZoom(); }, [uri, resetZoom]);

    const pinch = Gesture.Pinch()
        .onUpdate((e) => { scale.value = Math.min(5, Math.max(0.8, savedScale.value * e.scale)); })
        .onEnd(() => {
            if (scale.value < 1) { scale.value = withSpring(1); tx.value = withSpring(0); ty.value = withSpring(0); stx.value = 0; sty.value = 0; }
            savedScale.value = Math.max(1, scale.value);
        });
    const pan = Gesture.Pan()
        .onUpdate((e) => {
            if (scale.value <= 1) return;
            const mx = (W * (scale.value - 1)) / 2, my = (H * (scale.value - 1)) / 2;
            tx.value = Math.max(-mx, Math.min(mx, stx.value + e.translationX));
            ty.value = Math.max(-my, Math.min(my, sty.value + e.translationY));
        })
        .onEnd(() => { stx.value = tx.value; sty.value = ty.value; });
    const dbl = Gesture.Tap().numberOfTaps(2).onEnd(() => {
        if (scale.value > 1.05) { scale.value = withSpring(1); savedScale.value = 1; tx.value = withSpring(0); ty.value = withSpring(0); stx.value = 0; sty.value = 0; }
        else { scale.value = withSpring(2.5); savedScale.value = 2.5; }
    });
    const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

    const run = async (actions: ImageManipulator.Action[]) => {
        setBusy(true);
        try {
            const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG });
            setHistory((h) => [...h, uri]); setUri(out.uri);
        } catch (e) { console.warn('edit failed', e); } finally { setBusy(false); }
    };
    const crop = async (ratio: number) => {
        const { width: w, height: h } = await sizeOf(uri);
        let cw = w, ch = h;
        if (w / h > ratio) cw = Math.round(h * ratio); else ch = Math.round(w / ratio);
        setCropOpen(false);
        run([{ crop: { originX: Math.round((w - cw) / 2), originY: Math.round((h - ch) / 2), width: cw, height: ch } }]);
    };
    const undo = () => setHistory((h) => { if (!h.length) return h; setUri(h[h.length - 1]); return h.slice(0, -1); });
    // tick -> next step (with edits if any, otherwise the original media)
    const done = () => {
        if (!edited) { onSave(media); return; }
        onSave({ ...media, uri, name: media.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg' } as PickedMedia);
    };

    const Tool = ({ icon: Icon, label, onPress, active, disabled }: any) => (
        <Pressable onPress={onPress} disabled={disabled || busy} style={[styles.tool, (disabled || busy) && { opacity: 0.35 }]}>
            <Icon size={22} color={active ? '#A99BFF' : '#fff'} />
            <Text style={[styles.toolLabel, active && { color: '#A99BFF' }]}>{label}</Text>
        </Pressable>
    );

    return (
        <>
            <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, dbl)}>
                <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                </Animated.View>
            </GestureDetector>

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                <Pressable onPress={onClose} style={styles.round}><X size={22} color="#fff" /></Pressable>
                <TickButton onPress={done} busy={busy} />
            </View>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                {cropOpen && (
                    <View style={styles.chips}>
                        {([['1:1', 1], ['4:5', 4 / 5], ['16:9', 16 / 9], ['9:16', 9 / 16]] as const).map(([l, r]) => (
                            <Pressable key={l} style={styles.chip} onPress={() => crop(r)}><Text style={styles.chipText}>{l}</Text></Pressable>
                        ))}
                    </View>
                )}
                <View style={styles.tools}>
                    <Tool icon={RotateCw} label="Rotate" onPress={() => run([{ rotate: 90 }])} />
                    <Tool icon={FlipHorizontal} label="Flip" onPress={() => run([{ flip: ImageManipulator.FlipType.Horizontal }])} />
                    <Tool icon={Crop} label="Crop" active={cropOpen} onPress={() => setCropOpen((v) => !v)} />
                    <Tool icon={Undo2} label="Undo" disabled={!edited} onPress={undo} />
                </View>
            </View>
        </>
    );
}

/* ================= VIDEO ================= */
function VideoEditor({ media, onClose, onSave }: EditorProps) {
    const { width: W } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const TW = W - 40;

    const player = useVideoPlayer(media.uri, (p) => { p.loop = true; p.timeUpdateEventInterval = 0.1; p.play(); });
    const [dur, setDur] = useState<number>((media as any).duration ?? 0);
    const [range, setRange] = useState<[number, number]>([0, Math.min((media as any).duration ?? 0, MAX_SEC)]);
    const [thumbs, setThumbs] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const durRef = useRef(dur), rangeRef = useRef(range);
    durRef.current = dur; rangeRef.current = range;
    const alive = useRef(true);
    useEffect(() => () => { alive.current = false; }, []);

    const startPx = useSharedValue(0), endPx = useSharedValue(TW), head = useSharedValue(0), ctx = useSharedValue(0);

    useEffect(() => {
        const set = () => { if (player.duration > 0) setDur(player.duration); };
        set();
        const s1 = player.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay') set(); });
        const s2 = player.addListener('timeUpdate', ({ currentTime }) => {
            const [a, b] = rangeRef.current;
            if (durRef.current > 0) head.value = (currentTime / durRef.current) * TW;
            if (currentTime >= b - 0.05 || currentTime < a - 0.3) player.currentTime = a;
        });
        return () => { s1.remove(); s2.remove(); };
    }, [player, head, TW]);

    useEffect(() => {
        if (dur <= 0) return;
        const end = Math.min(dur, MAX_SEC);
        setRange([0, end]); startPx.value = 0; endPx.value = (end / dur) * TW;
        Promise.all(Array.from({ length: 8 }, (_, i) =>
            VideoThumbnails.getThumbnailAsync(media.uri, { time: Math.floor((i / 8) * dur * 1000), quality: 0.4 }).then((t) => t.uri)))
            .then((t) => { if (alive.current) setThumbs(t); }).catch(() => { });
    }, [dur]); // eslint-disable-line react-hooks/exhaustive-deps

    const commit = (s: number, e: number) => {
        const a = (s / TW) * dur, b = (e / TW) * dur;
        setRange([a, b]); player.currentTime = a;
    };
    const maxPx = (MAX_SEC / Math.max(dur, 0.01)) * TW, minPx = (MIN_SEC / Math.max(dur, 0.01)) * TW;

    const leftG = Gesture.Pan()
        .onStart(() => { ctx.value = startPx.value; })
        .onUpdate((e) => {
            let n = Math.max(0, Math.min(ctx.value + e.translationX, endPx.value - minPx));
            startPx.value = Math.max(n, endPx.value - maxPx);
        })
        .onEnd(() => runOnJS(commit)(startPx.value, endPx.value));
    const rightG = Gesture.Pan()
        .onStart(() => { ctx.value = endPx.value; })
        .onUpdate((e) => {
            let n = Math.min(TW, Math.max(ctx.value + e.translationX, startPx.value + minPx));
            endPx.value = Math.min(n, startPx.value + maxPx);
        })
        .onEnd(() => runOnJS(commit)(startPx.value, endPx.value));

    const frame = useAnimatedStyle(() => ({ left: startPx.value, width: endPx.value - startPx.value }));
    const lh = useAnimatedStyle(() => ({ left: startPx.value - HANDLE }));
    const rh = useAnimatedStyle(() => ({ left: endPx.value }));
    const dimL = useAnimatedStyle(() => ({ width: startPx.value }));
    const dimR = useAnimatedStyle(() => ({ left: endPx.value, width: TW - endPx.value }));
    const ph = useAnimatedStyle(() => ({ left: head.value }));

    // tick -> trim if needed, then next step
    const save = async () => {
        const [a, b] = range;
        const changed = dur > 0 && (a > 0.05 || b < dur - 0.05);
        setBusy(true);
        try {
            const uri = changed ? await trimVideo(media.uri, a, b) : media.uri;
            onSave({ ...media, uri, duration: changed ? b - a : (media as any).duration ?? dur } as PickedMedia);
        } catch (e) {
            console.warn('trim failed', e);
            Alert.alert('Trim failed', 'Could not trim this video. Try again or pick a shorter clip.');
        } finally { if (alive.current) setBusy(false); }
    };

    return (
        <>
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                <Pressable onPress={onClose} style={styles.round}><X size={22} color="#fff" /></Pressable>
                <TickButton onPress={save} busy={busy} />
            </View>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                <Text style={styles.trimInfo}>{fmt(range[0])} – {fmt(range[1])}  ·  {fmt(range[1] - range[0])} selected (max {MAX_SEC}s)</Text>
                <View style={{ height: 56, marginHorizontal: 20 }}>
                    <View style={styles.strip}>
                        {thumbs.map((t, i) => <Image key={i} source={{ uri: t }} style={{ width: TW / 8, height: 56 }} />)}
                    </View>
                    <Animated.View style={[styles.dim, { left: 0 }, dimL]} pointerEvents="none" />
                    <Animated.View style={[styles.dim, dimR]} pointerEvents="none" />
                    <Animated.View style={[styles.frame, frame]} pointerEvents="none" />
                    <Animated.View style={[styles.playhead, ph]} pointerEvents="none" />
                    <GestureDetector gesture={leftG}><Animated.View style={[styles.handle, lh, { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} hitSlop={{ left: 14, right: 6, top: 10, bottom: 10 }}><View style={styles.grip} /></Animated.View></GestureDetector>
                    <GestureDetector gesture={rightG}><Animated.View style={[styles.handle, rh, { borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} hitSlop={{ right: 14, left: 6, top: 10, bottom: 10 }}><View style={styles.grip} /></Animated.View></GestureDetector>
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    editorRoot: { flex: 1, backgroundColor: '#000' },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10, elevation: 10 },
    round: { height: 42, minWidth: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    tick: { height: 42, width: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 14, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10, elevation: 10 },
    tools: { flexDirection: 'row', justifyContent: 'space-around' },
    tool: { alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
    toolLabel: { color: '#fff', fontSize: 11.5, fontWeight: '600' },
    chips: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)' },
    chipText: { color: '#fff', fontWeight: '700' },
    trimInfo: { color: '#fff', textAlign: 'center', marginBottom: 12, fontWeight: '600', fontSize: 13 },
    strip: { flexDirection: 'row', height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1B1B22' },
    dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
    frame: { position: 'absolute', top: 0, bottom: 0, borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#fff' },
    playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' },
    handle: { position: 'absolute', top: 0, bottom: 0, width: HANDLE, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    grip: { width: 3, height: 20, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.45)' },
});