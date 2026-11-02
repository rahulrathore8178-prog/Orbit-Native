import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Grid3x3, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path
import { prepareMedia } from '../services/createPost/compressMedia'; // adjust path
import { CaptureButton, MAX_VIDEO_SECONDS } from './CaptureButton';
import { GALLERY_HEADER_H, GallerySheet } from './GallerySheet';

const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const haptic = (s: 'light' | 'medium') =>
  Haptics.impactAsync(s === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

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

export function AppCamera({ visible, openGallery, onClose, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const camRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [grid, setGrid] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [zoom, setZoom] = useState(0);

  const recRef = useRef(false);
  const busy = useRef(false);
  const recStart = useRef(0);
  const zoomRef = useRef(0);
  const zoomBase = useRef(0);
  const lastZoomTs = useRef(0);

  const PEEK = GALLERY_HEADER_H + insets.bottom;
  const SHEET_H = H - insets.top - 8;
  const closedY = SHEET_H - PEEK;
  const sheetY = useSharedValue(closedY);
  const shutter = useSharedValue(0);

  /* ----- permissions: camera first, then mic, the first time the camera opens ----- */
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
    sheetY.value = openGallery ? withSpring(0, { damping: 22, stiffness: 220 }) : closedY;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!openGallery) sheetY.value = closedY; }, [closedY]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSecs(Math.floor((Date.now() - recStart.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  const finish = useCallback((m: PickedMedia) => {
    prepareMedia(m).catch(() => { }); // pre-warm compression so tapping Post is instant
    onCapture(m);
  }, [onCapture]);

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

  /* ----- capture ----- */
  const takePhoto = useCallback(async () => {
    if (!camRef.current || !ready || busy.current || recRef.current) return;
    busy.current = true;
    haptic('light');
    shutter.value = withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 200 }));
    try {
      const p = await camRef.current.takePictureAsync({ quality: 0.85 });
      finish({ kind: 'image', uri: p.uri, name: `photo-${Date.now()}.jpg`, mime: 'image/jpeg', width: p.width, height: p.height } as PickedMedia);
    } catch (e) { console.warn('photo failed', e); } finally { busy.current = false; }
  }, [ready, finish, shutter]);

  const startRec = useCallback(async () => {
    const cam = camRef.current;
    if (!cam || !ready || recRef.current) return;
    recRef.current = true; recStart.current = Date.now(); zoomBase.current = zoomRef.current;
    setSecs(0); setRecording(true); haptic('medium');
    try {
      const v = await cam.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (v?.uri) {
        const ext = (v.uri.split('.').pop() || 'mp4').toLowerCase();
        finish({
          kind: 'video', uri: v.uri, name: `video-${Date.now()}.${ext}`,
          mime: ext === 'mov' ? 'video/quicktime' : 'video/mp4',
          duration: (Date.now() - recStart.current) / 1000,
        } as PickedMedia);
      }
    } catch (e) { console.warn('record failed', e); } finally { recRef.current = false; setRecording(false); }
  }, [ready, finish]);

  const stopRec = useCallback(() => {
    if (!recRef.current) return;
    const wait = Math.max(0, 600 - (Date.now() - recStart.current)); // avoid "stopped before any data" errors
    setTimeout(() => camRef.current?.stopRecording(), wait);
  }, []);

  const handleClose = useCallback(() => {
    if (sheetY.value < closedY * 0.5) { sheetY.value = withSpring(closedY, { damping: 22, stiffness: 220 }); return; }
    if (recRef.current) camRef.current?.stopRecording();
    onClose();
  }, [closedY, onClose, sheetY]);

  const cycleFlash = () => { haptic('light'); setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % 3]); };

  const shutterStyle = useAnimatedStyle(() => ({ opacity: shutter.value * 0.85 }));

  const permissionBlocked = camPerm && !camPerm.granted;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.root}>
        {permissionBlocked ? (
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
                  mode="video"
                  flash={flash}
                  enableTorch={recording && flash === 'on'}
                  zoom={zoom}
                  mute={!micPerm?.granted}
                  videoQuality="720p"
                  onCameraReady={() => setReady(true)}
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

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, shutterStyle]} />

            {/* top bar */}
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

            {/* bottom controls */}
            <View style={[styles.bottom, { bottom: PEEK + 8 }]} pointerEvents="box-none">
              {zoom > 0.01 ? (
                <View style={styles.zoomBar}><View style={[styles.zoomFill, { width: `${zoom * 100}%` }]} /></View>
              ) : (
                <Text style={[styles.hint, recording && { opacity: 0 }]}>Tap for photo · Hold for video</Text>
              )}
              <CaptureButton
                recording={recording}
                disabled={!ready}
                onTap={takePhoto}
                onHoldStart={startRec}
                onHoldEnd={stopRec}
                onZoomDrag={onZoomDrag}
              />
            </View>

            <GallerySheet sheetY={sheetY} closedY={closedY} height={SHEET_H} bottomInset={insets.bottom} onPick={finish} />
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Reusable hook: const cam = useAppCamera(onMedia); cam.open(); render {cam.element} somewhere. */
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
      onCapture={(m) => { setVisible(false); onMedia(m); }}
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
  zoomBar: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 8, overflow: 'hidden' },
  zoomFill: { height: '100%', backgroundColor: '#fff' },
  line: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  perm: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  permText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 8 },
  cta: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  ctaText: { fontWeight: '800' },
});