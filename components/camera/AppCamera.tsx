import * as Brightness from 'expo-brightness';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraMode, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Grid3x3, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path
import { prepareMedia } from '../services/createPost/compressMedia'; // adjust path
import { CaptureButton, MAX_VIDEO_SECONDS } from './CaptureButton';
import { GALLERY_HEADER_H, GallerySheet, SHEET_SPRING } from './GallerySheet';
import { MediaEditor } from './MediaViewer';

const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const haptic = (s: 'light' | 'medium') =>
  Haptics.impactAsync(s === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

/** Saves a captured photo/video to the phone's gallery (best effort, never blocks the flow). */
async function saveToGallery(uri: string) {
  try {
    let p = await MediaLibrary.getPermissionsAsync(true);
    if (!p.granted && p.canAskAgain) p = await MediaLibrary.requestPermissionsAsync(true);
    if (p.granted) await MediaLibrary.saveToLibraryAsync(uri);
  } catch (e) { console.warn('save to gallery failed', e); }
}

const RoundBtn = ({ onPress, children }: { onPress: () => void; children: React.ReactNode }) => (
  <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}>
    {children}
  </Pressable>
);

type Props = {
  visible: boolean;
  openGallery?: boolean;
  onClose: () => void;
  onCapture: (m: PickedMedia) => void;
};

type Pending = { media: PickedMedia; fromCamera: boolean };

export function AppCamera({ visible, openGallery, onClose, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const camRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mode, setMode] = useState<CameraMode>('picture');
  const [grid, setGrid] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);

  const modeRef = useRef<CameraMode>('picture');
  const modeWaiter = useRef<(() => void) | null>(null);
  const recRef = useRef(false);
  const active = useRef(false);
  const stopReq = useRef(false);
  const discard = useRef(false);
  const busy = useRef(false);
  const recStart = useRef(0);
  const zoomRef = useRef(0);
  const zoomBase = useRef(0);
  const lastZoomTs = useRef(0);
  const readyRef = useRef(false);
  readyRef.current = ready;

  const frontFlash = facing === 'front' && flash !== 'off';
  const frontFlashRef = useRef(false);
  frontFlashRef.current = frontFlash;
  const glowActive = frontFlash && visible && !pending;

  const PEEK = GALLERY_HEADER_H + insets.bottom;
  const SHEET_H = H - insets.top - 8;
  const closedY = SHEET_H - PEEK;
  const sheetY = useSharedValue(closedY);
  const shutter = useSharedValue(0);
  const glow = useSharedValue(0);
  const boost = useSharedValue(0);

  /* ----- permissions ----- */
  useEffect(() => {
    if (!visible || !camPerm || !micPerm) return;
    (async () => {
      if (!camPerm.granted && camPerm.canAskAgain) await requestCam();
      if (!micPerm.granted && micPerm.canAskAgain) await requestMic();
    })();
  }, [visible, camPerm?.granted, micPerm?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- reset every time it opens ----- */
  useEffect(() => {
    if (!visible) return;
    setReady(false); setZoom(0); zoomRef.current = 0; setFlash('off'); setFacing('back');
    setMode('picture'); modeRef.current = 'picture'; setPending(null);
    sheetY.value = openGallery ? withSpring(0, SHEET_SPRING) : closedY;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!openGallery) sheetY.value = closedY; }, [closedY]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera is unmounted while editing; it re-reports ready when it comes back
  useEffect(() => { if (pending) setReady(false); }, [pending]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSecs(Math.floor((Date.now() - recStart.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  /* ----- front "screen flash": white wash + max brightness ----- */
  useEffect(() => { glow.value = withTiming(glowActive ? 1 : 0, { duration: 220 }); }, [glowActive, glow]);

  useEffect(() => {
    if (!glowActive) return;
    let cancelled = false;
    let prev: number | null = null;
    (async () => {
      try {
        prev = await Brightness.getBrightnessAsync();
        if (!cancelled) await Brightness.setBrightnessAsync(1);
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      (async () => {
        try {
          if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
          else if (prev != null) await Brightness.setBrightnessAsync(prev);
        } catch { /* ignore */ }
      })();
    };
  }, [glowActive]);

  /** Capture/pick done -> open the edit screen (camera + gallery sheet unmount underneath). */
  const finish = useCallback((m: PickedMedia, fromCamera: boolean) => {
    setPending({ media: m, fromCamera });
  }, []);

  /** "Proceed": save camera captures to the phone gallery, then hand the media to the composer. */
  const proceed = useCallback((m: PickedMedia) => {
    if (pending?.fromCamera) saveToGallery(m.uri);
    try { (prepareMedia(m) as any)?.catch?.(() => { }); } catch { /* pre-warm is best effort */ }
    setPending(null);
    onCapture(m);
  }, [pending, onCapture]);

  /* ----- zoom ----- */
  const applyZoom = useCallback((z: number) => {
    z = Math.min(1, Math.max(0, z));
    zoomRef.current = z;
    const now = Date.now();
    if (now - lastZoomTs.current > 32 || z === 0 || z === 1) { lastZoomTs.current = now; setZoom(z); }
  }, []);

  const onZoomDrag = useCallback((dy: number) => {
    const t = -dy / 320;
    applyZoom(zoomBase.current + Math.sign(t) * Math.pow(Math.abs(t), 1.3));
  }, [applyZoom]);

  const flip = useCallback(() => {
    haptic('light'); setFacing((f) => (f === 'back' ? 'front' : 'back')); applyZoom(0);
  }, [applyZoom]);

  const previewGesture = Gesture.Simultaneous(
    Gesture.Pinch().runOnJS(true)
      .onStart(() => { zoomBase.current = zoomRef.current; })
      .onUpdate((e) => applyZoom(zoomBase.current + (e.scale - 1) * 0.45)),
    Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd((_e, ok) => { if (ok) flip(); }),
  );

  /* ----- photo ----- */
  const takePhoto = useCallback(async () => {
    const cam = camRef.current;
    if (!cam || !readyRef.current || busy.current || recRef.current) return;
    busy.current = true;
    haptic('light');
    let photo: { uri: string; width: number; height: number } | null = null;
    try {
      if (frontFlashRef.current) {
        boost.value = withTiming(1, { duration: 110 });
        await sleep(160);
      } else {
        shutter.value = withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 200 }));
      }
      photo = await cam.takePictureAsync({ quality: 0.9 });
    } catch (e) {
      console.warn('capture failed', e);
    } finally {
      boost.value = withTiming(0, { duration: 250 });
      busy.current = false;
    }
    if (photo) {
      finish({ kind: 'image', uri: photo.uri, name: `photo-${Date.now()}.jpg`, mime: 'image/jpeg', width: photo.width, height: photo.height } as PickedMedia, true);
    }
  }, [finish, shutter, boost]);

  /* ----- video ----- */
  const stopScheduled = useRef(false);

  const doStop = useCallback(() => {
    if (stopScheduled.current) return;
    stopScheduled.current = true;
    // stopping too early makes the native recorder fail with "Unknown error"
    const wait = Math.max(0, 1200 - (Date.now() - recStart.current));
    setTimeout(() => {
      try { camRef.current?.stopRecording(); } catch { }
    }, wait);
  }, []);

  const startRec = useCallback(async () => {
    if (recRef.current || busy.current || !readyRef.current) return;
    recRef.current = true; stopReq.current = false; discard.current = false; active.current = false;
    stopScheduled.current = false;
    zoomBase.current = zoomRef.current;
    setSecs(0); setRecording(true); haptic('medium');

    let video: { uri: string } | undefined;
    try {
      if (modeRef.current !== 'video') {
        modeRef.current = 'video';
        setMode('video');
        await new Promise<void>((res) => { modeWaiter.current = res; setTimeout(res, 700); });
        await sleep(250);
      }
      const cam = camRef.current;
      if (!cam || stopReq.current || discard.current) return;

      const attempt = () => {
        recStart.current = Date.now();
        active.current = true;
        const p = cam.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
        if (stopReq.current) doStop();
        return p;
      };
      video = await attempt().catch(async (e) => {
        if (stopReq.current || discard.current) throw e;
        console.warn('record retry', e);
        await sleep(450);
        return attempt();
      });
    } catch (e) {
      console.warn('record failed', e);
    } finally {
      const dur = (Date.now() - recStart.current) / 1000;
      recRef.current = false; active.current = false; setRecording(false);
      modeRef.current = 'picture'; setMode('picture');
      if (video?.uri && !discard.current) {
        const ext = (video.uri.split('.').pop() || 'mp4').toLowerCase();
        finish({
          kind: 'video', uri: video.uri, name: `video-${Date.now()}.${ext}`,
          mime: ext === 'mov' ? 'video/quicktime' : 'video/mp4', duration: dur,
        } as PickedMedia, true);
      }
    }
  }, [finish, doStop]);

  const stopRec = useCallback(() => {
    if (!recRef.current) return;
    stopReq.current = true;
    setRecording(false);          // the button resets right away, even if the native stop is still finishing
    if (active.current) doStop();
  }, [doStop]);

  const handleClose = useCallback(() => {
    if (pending) { setPending(null); return; }
    if (sheetY.value < closedY * 0.5) { sheetY.value = withSpring(closedY, SHEET_SPRING); return; }
    if (recRef.current) { discard.current = true; stopReq.current = true; camRef.current?.stopRecording(); }
    onClose();
  }, [pending, closedY, onClose, sheetY]);

  const cycleFlash = () => { haptic('light'); setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % 3]); };

  const shutterStyle = useAnimatedStyle(() => ({ opacity: shutter.value * 0.85 }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * (0.5 + 0.4 * boost.value) }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: interpolate(sheetY.value, [closedY, 0], [0, 0.55], 'clamp') }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: interpolate(sheetY.value, [closedY, closedY * 0.7], [1, 0], 'clamp') }));

  const permissionBlocked = camPerm && !camPerm.granted;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.root}>
        {pending ? (
          /*
           * EDIT SCREEN: the ONLY thing rendered while editing. The camera, gallery sheet and
           * overlays are all unmounted, so nothing can sit on top of the Proceed button or
           * swallow its touches.
           */
          <MediaEditor
            key={pending.media.uri}
            media={pending.media}
            confirmLabel="Proceed"
            onClose={() => setPending(null)}
            onSave={proceed}
          />
        ) : permissionBlocked ? (
          <View style={styles.perm}>
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permText}>Allow camera access to take photos and videos.</Text>
            <Pressable style={styles.cta} onPress={() => (camPerm?.canAskAgain ? requestCam() : Linking.openSettings())}>
              <Text style={styles.ctaText}>{camPerm?.canAskAgain ? 'Allow camera' : 'Open settings'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ padding: 12 }}><Text style={{ color: '#fff' }}>Not now</Text></Pressable>
          </View>
        ) : (
          <>
            <GestureDetector gesture={previewGesture}>
              <View style={StyleSheet.absoluteFill}>
                <CameraView
                  ref={camRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  mode={mode}
                  flash={facing === 'back' ? flash : 'off'}
                  enableTorch={recording && flash === 'on' && facing === 'back'}
                  zoom={zoom}
                  mute={!micPerm?.granted}
                  videoQuality="1080p"
                  onCameraReady={() => { setReady(true); modeWaiter.current?.(); modeWaiter.current = null; }}
                />
                {grid && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {[1, 2].map((i) => (
                      <React.Fragment key={i}>
                        <View style={[styles.line, { left: (W / 3) * i, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
                        <View style={[styles.line, { top: (H / 3) * i, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            </GestureDetector>

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, glowStyle]} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, shutterStyle]} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, dimStyle]} />

            <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
              <RoundBtn onPress={handleClose}><X size={22} color="#fff" /></RoundBtn>
              {recording ? (
                <View style={styles.timer}>
                  <View style={styles.recDot} />
                  <Text style={styles.timerText}>{mm(secs)}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <RoundBtn onPress={cycleFlash}>
                    {flash === 'off' ? <ZapOff size={20} color="#fff" /> : <Zap size={20} color={flash === 'on' ? '#FFD60A' : '#fff'} fill={flash === 'on' ? '#FFD60A' : 'none'} />}
                    {flash === 'auto' && <Text style={styles.auto}>A</Text>}
                  </RoundBtn>
                  <RoundBtn onPress={() => setGrid((g) => !g)}><Grid3x3 size={20} color={grid ? '#FFD60A' : '#fff'} /></RoundBtn>
                  <RoundBtn onPress={flip}><SwitchCamera size={20} color="#fff" /></RoundBtn>
                </View>
              )}
            </View>

            <Animated.View style={[styles.bottom, { bottom: PEEK + 8 }, controlsStyle]} pointerEvents="box-none">
              {zoom > 0.01 ? (
                <View style={styles.zoomBar}><View style={[styles.zoomFill, { width: `${zoom * 100}%` }]} /></View>
              ) : (
                <Text style={[styles.hint, frontFlash && styles.hintDark, recording && { opacity: 0 }]}>Tap for photo · Hold for video</Text>
              )}
              <View style={frontFlash ? styles.btnBacking : undefined}>
                <CaptureButton
                  recording={recording}
                  disabled={!ready}
                  onTap={takePhoto}
                  onHoldStart={startRec}
                  onHoldEnd={stopRec}
                  onZoomDrag={onZoomDrag}
                />
              </View>
            </Animated.View>

            <GallerySheet sheetY={sheetY} closedY={closedY} height={SHEET_H} bottomInset={insets.bottom} onPick={(m) => finish(m, false)} />
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** const cam = useAppCamera(onMedia); cam.open(); render {cam.element} somewhere. */
export function useAppCamera(onMedia: (m: PickedMedia) => void) {
  const [visible, setVisible] = useState(false);
  const [gallery, setGallery] = useState(false);
  const open = useCallback((opts?: { gallery?: boolean }) => { setGallery(!!opts?.gallery); setVisible(true); }, []);
  const close = useCallback(() => setVisible(false), []);
  const element = (
    <AppCamera
      visible={visible}
      openGallery={gallery}
      onClose={close}
      onCapture={(m) => {
        setVisible(false);
        try { onMedia(m); }
        catch (e) { console.warn('onMedia handler threw: check the function passed to ComposerFooter', e); }
      }}
    />
  );
  return { open, close, element };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' },
  auto: { position: 'absolute', right: 8, bottom: 6, color: '#fff', fontSize: 9, fontWeight: '800' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3B4E' },
  timerText: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  hintDark: { color: '#111', textShadowColor: 'rgba(255,255,255,0.7)' },
  btnBacking: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 80 },
  zoomBar: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 8, overflow: 'hidden' },
  zoomFill: { height: '100%', backgroundColor: '#fff' },
  line: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  perm: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  permText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 8 },
  cta: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  ctaText: { fontWeight: '800' },
});