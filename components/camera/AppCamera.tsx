import * as MediaLibrary from 'expo-media-library/legacy';
import React, { useCallback, useState } from 'react';
import { Modal, NativeModules, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { PickedMedia } from '../../constants/createPost/types'; // adjust path
import { prepareMedia } from '../services/createPost/compressMedia'; // adjust path
import { MediaEditor } from './MediaViewer';

const Native = NativeModules.AppCamera;

/** Saves a captured photo/video to the phone's gallery (best effort, never blocks the flow). */
async function saveToGallery(uri: string) {
  try {
    let p = await MediaLibrary.getPermissionsAsync(true);
    if (!p.granted && p.canAskAgain) p = await MediaLibrary.requestPermissionsAsync(true);
    if (p.granted) await MediaLibrary.saveToLibraryAsync(uri);
  } catch (e) { console.warn('save to gallery failed', e); }
}

type Pending = { media: PickedMedia; fromCamera: boolean };

/** const cam = useAppCamera(onMedia); cam.open(); render {cam.element} somewhere. */
export function useAppCamera(onMedia: (m: PickedMedia) => void) {
  const [pending, setPending] = useState<Pending | null>(null);

  const open = useCallback(async (opts?: { gallery?: boolean }) => {
    if (Platform.OS !== 'android' || !Native) {
      console.warn('Native camera missing: Android only, and needs a rebuilt dev client');
      return;
    }
    try {
      const r = await Native.open({ gallery: !!opts?.gallery });
      if (!r) return; // user cancelled
      setPending({
        fromCamera: !!r.fromCamera,
        media: {
          kind: r.kind, uri: r.uri, name: r.name, mime: r.mime,
          width: r.width, height: r.height, duration: r.duration,
        } as PickedMedia,
      });
    } catch (e) { console.warn('camera failed', e); }
  }, []);

  const close = useCallback(() => setPending(null), []);

  const proceed = useCallback((m: PickedMedia) => {
    if (pending?.fromCamera) saveToGallery(m.uri);
    try { (prepareMedia(m) as any)?.catch?.(() => { }); } catch { /* best effort */ }
    setPending(null);
    try { onMedia(m); }
    catch (e) { console.warn('onMedia handler threw: check the function passed to ComposerFooter', e); }
  }, [pending, onMedia]);

  const element = pending ? (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <MediaEditor
          key={pending.media.uri}
          media={pending.media}
          confirmLabel="Proceed"
          onClose={() => { setPending(null); open(); }} // back = retake
          onSave={proceed}
        />
      </GestureHandlerRootView>
    </Modal>
  ) : null;

  return { open, close, element };
}