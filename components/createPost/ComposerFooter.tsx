import { Camera, Image as ImageIcon, Mic, Square, Video } from 'lucide-react-native';
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../../constants/createPost/theme';
import { COMING_SOON_MESSAGE } from '@/constants/createPost/constants';
import { NeoButton, NeoIconButton } from '../ui/createPost/NeoButton';
import { ComingSoonToast } from './ComingSoonToast';

type Props = {
  onGallery: () => void;
  onCamera: () => void;
  onVideo: () => void;
  onMic: () => void;
  micActive: boolean;
  toastVisible: boolean;
  onPost: () => void;
  canPost: boolean;
  isPosting: boolean;
};

/** Thumb-friendly toolbar: media tools on the left, a wide Post button on the right. */
export function ComposerFooter({
  onGallery,
  onCamera,
  onVideo,
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
  const hasCamera = Platform.OS !== 'web';

  return (
    <View style={styles.footer}>
      <ComingSoonToast visible={toastVisible} message={COMING_SOON_MESSAGE} />

      <NeoIconButton Icon={ImageIcon} label="Add photo or video" onPress={onGallery} size={size} />
      {hasCamera && <NeoIconButton Icon={Camera} label="Take a photo" onPress={onCamera} size={size} />}
      {hasCamera && <NeoIconButton Icon={Video} label="Record a video" onPress={onVideo} size={size} />}
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
