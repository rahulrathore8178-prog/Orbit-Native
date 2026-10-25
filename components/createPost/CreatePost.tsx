import { DESTINATIONS } from '@/constants/createPost/constants';
import { useCurrentUser } from '@/hooks/createPost/useCurrentUser';
import { useDestinationPan } from '@/hooks/createPost/useDestinationPan';
import { useTransientFlag } from '@/hooks/createPost/useTransientFlag';
import { useVoiceNote } from '@/hooks/createPost/useVoiceNote';
import { useCallback, useEffect } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { CreatePostProps, Destination } from '../../constants/createPost/types';
import { ComposerFooter } from './ComposerFooter';
import { useMediaPicker } from '@/hooks/createPost/useMediaPicker';
import { selectCreatePost } from '../../hooks/createPost/selectors';
import {
  clearMedia,
  closeComposer,
  loadOrbitals,
  openComposer,
  selectOrbital,
  setCaption,
  setDestination,
  submitPost,
} from '../../redux/slice/createPost/createPostSlice';
import { useCreatePostDispatch, useCreatePostSelector } from '../../redux/slice/createPost/hooks';
import { analyzeImage } from '../services/createPost/postApi';
import { BottomSheet } from './BottomSheet';
import { CaptionInput } from './CaptionInput';
import { ComposerFab } from './ComposerFab';
import { ComposerHeader } from './ComposerHeader';
import { DestinationPager } from './DestinationPager';
import { DestinationTabs } from './DestinationTabs';
import { ErrorBanner } from './ErrorBanner';
import { MediaPreview } from './MediaPreview';
// [VOICE-NOTES] import { MAX_RECORDING_SECONDS, RecordingBar, VoiceNotePreview } from './external';

const notify = (title: string, message: string) =>
  Platform.OS === 'web' ? window.alert(`${title}\n\n${message}`) : Alert.alert(title, message);

/**
 * Container: wires redux state, hooks and the presentational components together.
 * Anything visual lives in ./components, anything stateful in ./store and ./hooks.
 */
export default function CreatePost({ onPostCreated, user, bottomOffset = 100 }: CreatePostProps) {
  const dispatch = useCreatePostDispatch();
  const { isOpen, destination, caption, media, selectedOrbitalId, orbitals, orbitalsStatus, status, error } =
    useCreatePostSelector(selectCreatePost);

  const currentUser = useCurrentUser(user);
  const voiceNote = useVoiceNote(); // inert until enabled, see hooks/useVoiceNote.ts
  const picker = useMediaPicker(!!voiceNote.voice || voiceNote.isRecording);
  const [comingSoon, showComingSoon] = useTransientFlag(1800);

  const isPosting = status === 'posting';
  const hasVoice = !!voiceNote.voice;
  const hasContent = caption.trim().length > 0 || !!media || hasVoice;
  const hasDraft = hasContent || voiceNote.isRecording;
  const canPost = !isPosting && !voiceNote.isRecording && hasContent;

  /* ----- destination swipe ----- */
  const changeDestination = useCallback((d: Destination) => dispatch(setDestination(d)), [dispatch]);
  const { progress, gesture, setPageWidth } = useDestinationPan(destination, changeDestination, !isPosting);

  /* ----- orbitals: prefetch as soon as the sheet opens so the swipe never shows a spinner ----- */
  useEffect(() => {
    if (isOpen && orbitalsStatus === 'idle' && orbitals === null) dispatch(loadOrbitals());
  }, [isOpen, orbitalsStatus, orbitals, dispatch]);

  /* ----- actions ----- */
  const requestClose = useCallback(async () => {
    if (isPosting) return;
    if (voiceNote.isRecording) await voiceNote.stop(); // keep what was recorded as the draft
    dispatch(closeComposer());
  }, [isPosting, voiceNote, dispatch]);

  const handlePost = useCallback(async () => {
    const imageToAnalyze = media?.kind === 'image' ? media : null; // redux clears media on success
    try {
      const { created, failed } = await dispatch(submitPost({ voice: voiceNote.voice })).unwrap();

      created.forEach((c) => {
        onPostCreated?.(c.post, c.target);
        if (imageToAnalyze) analyzeImage(imageToAnalyze, c.post?.id ?? c.post?._id);
      });
      voiceNote.remove();

      if (failed.length) {
        notify(
          'Partly posted',
          `Posted to ${created.map((c) => c.target).join(' & ')}, but the ${failed
            .map((f) => f.target)
            .join(' & ')} post failed: ${failed[0].message}`,
        );
      }
    } catch {
      // the error message is already in redux and shown by <ErrorBanner />
    }
  }, [dispatch, media, onPostCreated, voiceNote]);

  // [VOICE-NOTES] when enabling voice notes, replace the line below with:
  //   const onMicPress = voiceNote.isRecording ? voiceNote.stop : voiceNote.start;
  const onMicPress = showComingSoon;

  const subtitle = DESTINATIONS.find((d) => d.value === destination)?.subtitle ?? '';

  return (
    <>
      <ComposerFab onPress={() => dispatch(openComposer())} hasDraft={hasDraft} bottomOffset={bottomOffset} />

      <BottomSheet visible={isOpen} onClose={requestClose} dismissible={!isPosting}>
        <ComposerHeader
          username={currentUser.username}
          profilePic={currentUser.profilePic}
          subtitle={subtitle}
          onClose={requestClose}
        />

        <ScrollView
          style={{ flexShrink: 1, flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        >
          {/* swipe anywhere in here to switch Feed ⇄ Orbital */}
          <GestureDetector gesture={gesture}>
            <View collapsable={false} style={{ gap: 12 }} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
              <DestinationTabs progress={progress} onSelect={changeDestination} disabled={isPosting} />

              <DestinationPager
                progress={progress}
                orbitals={orbitals}
                orbitalsStatus={orbitalsStatus}
                selectedOrbitalId={selectedOrbitalId}
                onSelectOrbital={(id) => dispatch(selectOrbital(id))}
                onRetryOrbitals={() => dispatch(loadOrbitals())}
              />

              {media && (
                <MediaPreview media={media} onChange={picker.pickFromGallery} onRemove={() => dispatch(clearMedia())} />
              )}

              {/* [VOICE-NOTES] uncomment together with the import at the top and the hook in hooks/useVoiceNote.ts
              {voiceNote.isRecording && (
                <RecordingBar seconds={voiceNote.seconds} max={MAX_RECORDING_SECONDS} onStop={voiceNote.stop} />
              )}
              {voiceNote.voice && !voiceNote.isRecording && (
                <VoiceNotePreview
                  key={voiceNote.voice.uri}
                  uri={voiceNote.voice.uri}
                  duration={voiceNote.voice.duration}
                  onRemove={voiceNote.remove}
                />
              )}
              */}

              <CaptionInput value={caption} onChange={(v) => dispatch(setCaption(v))} editable={!isPosting} />
            </View>
          </GestureDetector>
        </ScrollView>

        <ErrorBanner message={error || voiceNote.error} />

        <ComposerFooter
          onGallery={picker.pickFromGallery}
          onCamera={picker.takePhoto}
          onVideo={picker.recordVideo}
          onMic={onMicPress}
          micActive={voiceNote.isRecording}
          toastVisible={comingSoon}
          onPost={handlePost}
          canPost={canPost}
          isPosting={isPosting}
        />
      </BottomSheet>
    </>
  );
}
