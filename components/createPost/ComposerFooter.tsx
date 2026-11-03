import { Camera, Image as ImageIcon, Mic, Square, Video } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COMING_SOON_MESSAGE } from '@/constants/createPost/constants';
import type { PickedMedia } from '../../constants/createPost/types';
import { theme } from '../../constants/createPost/theme';
import { NeoButton, NeoIconButton } from '../ui/createPost/NeoButton';
import { useAppCamera } from '../camera/AppCamera'; // adjust path
import { ComingSoonToast } from './ComingSoonToast';

type Props = {
  /** Called with the photo/video captured by the camera or picked from the gallery sheet. */
  onMedia: (m: PickedMedia) => void;
  /** Web only: the camera/gallery sheet is native, so fall back to your existing picker. */
  onWebGallery?: () => void;
  onMic: () => void;
  micActive: boolean;
  toastVisible: boolean;
  onPost: () => void;
  canPost: boolean;
  isPosting: boolean;
};

/** Thumb-friendly toolbar: media tools on the left, a wide Post button on the right. */
export function ComposerFooter({
  onMedia,
  onWebGallery,
  onMic,
  micActive,
  toastVisible,
  onPost,
  canPost,
  isPosting,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 380; // small phones: slightly smaller buttons so Post never gets squeezed
  const size = compact ? 42 : 46;
  const isNative = Platform.OS !== 'web';

  const cam = useAppCamera(onMedia);

  const openGallery = useCallback(() => {
    if (isNative) cam.open({ gallery: true });
    else onWebGallery?.();
  }, [cam, isNative, onWebGallery]);

  const openCamera = useCallback(() => cam.open(), [cam]);

  return (
    <View style={styles.footer}>
      <ComingSoonToast visible={toastVisible} message={COMING_SOON_MESSAGE} />

      <NeoIconButton Icon={ImageIcon} label="Add photo or video" onPress={openGallery} size={size} />
      {isNative && <NeoIconButton Icon={Camera} label="Take a photo" onPress={openCamera} size={size} />}
      {isNative && <NeoIconButton Icon={Video} label="Record a video (hold the shutter)" onPress={openCamera} size={size} />}
      <NeoIconButton
        Icon={micActive ? Square : Mic}
        label={micActive ? 'Stop recording' : 'Voice note (coming soon)'}
        onPress={onMic}
        size={size}
        selected={micActive}
        color={micActive ? theme.colors.danger : theme.colors.textDim}
      />

      <NeoButton
        // light "pearl" when it can be tapped, sunken dark when it can't
        tone={canPost || isPosting ? 'light' : 'dark'}
        radius={18}
        onPress={onPost}
        disabled={!canPost}
        label="Post"
        style={{ flex: 1, height: size + 4, minWidth: 84 }}
      >
        {isPosting ? (
          <ActivityIndicator color={theme.colors.postText} />
        ) : (
          <Text style={[styles.postText, !canPost && styles.postTextDisabled]}>Post</Text>
        )}
      </NeoButton>

      {/* Full-screen modal: renders outside the row layout, so it doesn't affect spacing */}
      {isNative && cam.element}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  postText: { color: theme.colors.postText, fontSize: 15.5, fontWeight: '800', letterSpacing: 0.4 },
  postTextDisabled: { color: theme.colors.postDisabledText },
});