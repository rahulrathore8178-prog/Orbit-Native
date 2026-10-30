import { DESTINATIONS } from '@/constants/createPost/constants';
import { useCurrentUser } from '@/hooks/createPost/useCurrentUser';
import { useDestinationPan } from '@/hooks/createPost/useDestinationPan';
import { useMediaPicker } from '@/hooks/createPost/useMediaPicker';
import { useTransientFlag } from '@/hooks/createPost/useTransientFlag';
import { useVoiceNote } from '@/hooks/createPost/useVoiceNote';
import { useCallback, useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { CreatePostProps, Destination } from '../../constants/createPost/types';
import {
  clearMedia,
  closeComposer,
  loadOrbitals,
  openComposer,
  setCaption,
  setDestination,
  setError,
  submitPost,
  toggleOrbital,
  type PostDraft,
} from '../../redux/slice/createPost/createPostSlice';
import { useCreatePostDispatch, useCreatePostSelector } from '../../redux/slice/createPost/hooks';
import { analyzeImage } from '../services/createPost/postApi';
import { showToast } from '../ui/GlassToast'; // <-- adjust to wherever your toast file lives
import { BottomSheet } from './BottomSheet';
import { CaptionInput } from './CaptionInput';
import { ComposerFab } from './ComposerFab';
import { ComposerFooter } from './ComposerFooter';
import { ComposerHeader } from './ComposerHeader';
import { DestinationPager } from './DestinationPager';
import { DestinationTabs } from './DestinationTabs';
import { ErrorBanner } from './ErrorBanner';
import { MediaPreview } from './MediaPreview';
// [VOICE-NOTES] import { MAX_RECORDING_SECONDS, RecordingBar, VoiceNotePreview } from './external';

const EMPTY_IDS: string[] = []; // stable reference, so memoized children don't re-render

/** Held long enough for big uploads; the success / error toast replaces it in place when the request ends. */
const POSTING_TOAST_MS = 120_000;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Container: wires redux state, hooks and the presentational components together.
 * Posting is fire-and-forget from the UI's point of view: the sheet closes immediately,
 * a toast shows progress, and the upload continues in the background (see submitPost in the slice).
 */
export default function CreatePost({ user, bottomOffset = 100 }: CreatePostProps) {
  const dispatch = useCreatePostDispatch();
  const { isOpen, destination, caption, media, orbitals, orbitalsStatus, error, ...rest } = useCreatePostSelector(
    (s) => s.createPost,
  );
  const selectedOrbitalIds = rest.selectedOrbitalIds ?? EMPTY_IDS;

  const currentUser = useCurrentUser(user);
  const voiceNote = useVoiceNote(); // inert until enabled, see hooks/useVoiceNote.ts
  const picker = useMediaPicker(!!voiceNote.voice || voiceNote.isRecording);
  const [comingSoon, showComingSoon] = useTransientFlag(1800);

  const hasVoice = !!voiceNote.voice;
  const hasContent = caption.trim().length > 0 || !!media || hasVoice;
  const hasDraft = hasContent || voiceNote.isRecording;
  const canPost = !voiceNote.isRecording && hasContent;

  /* ----- destination swipe ----- */
  const changeDestination = useCallback((d: Destination) => dispatch(setDestination(d)), [dispatch]);
  const { progress, gesture, setPageWidth } = useDestinationPan(destination, changeDestination, true);

  /* ----- orbitals: prefetch as soon as the sheet opens so the swipe never shows a spinner ----- */
  useEffect(() => {
    if (isOpen && orbitalsStatus === 'idle' && orbitals === null) dispatch(loadOrbitals());
  }, [isOpen, orbitalsStatus, orbitals, dispatch]);

  /* ----- actions ----- */
  const requestClose = useCallback(async () => {
    if (voiceNote.isRecording) await voiceNote.stop(); // keep what was recorded as the draft
    dispatch(closeComposer());
  }, [voiceNote, dispatch]);

  const handlePost = useCallback(() => {
    if (!canPost) return;
    if (destination === 'orbital' && !selectedOrbitalIds.length) {
      dispatch(setError('Select at least one orbital'));
      return;
    }

    // snapshot now: the slice closes the sheet and clears the draft the moment we dispatch
    const draft: PostDraft = { destination, caption, media, orbitalIds: selectedOrbitalIds, voice: voiceNote.voice };
    const imageToAnalyze = media?.kind === 'image' ? media : null;

    showToast({
      title: 'Posting…',
      subtitle: destination === 'orbital' ? plural(selectedOrbitalIds.length, 'orbital') : 'Community feed',
      variant: 'info',
      icon: 'cloud-upload-outline',
      duration: POSTING_TOAST_MS,
      haptic: false,
    });

    dispatch(submitPost(draft))
      .unwrap()
      .then(({ created, failed }) => {
        if (imageToAnalyze) created.forEach((c) => analyzeImage(imageToAnalyze, c.post?.id ?? c.post?._id));

        if (failed.length) {
          showToast({
            title: 'Partly posted',
            subtitle: `${created.length} of ${created.length + failed.length} succeeded. ${failed[0].message}`,
            variant: 'error',
            duration: 4000,
          });
          return;
        }
        showToast({
          title: 'Posted',
          subtitle: destination === 'orbital' ? `Shared to ${plural(created.length, 'orbital')}` : 'Shared to the community feed',
          variant: 'success',
        });
      })
      .catch((message: unknown) => {
        showToast({
          title: 'Post failed',
          subtitle: `${typeof message === 'string' ? message : 'Something went wrong'}. Your draft was restored.`,
          variant: 'error',
          duration: 4000,
        });
      });

    voiceNote.remove();
  }, [canPost, destination, selectedOrbitalIds, caption, media, voiceNote, dispatch]);

  // [VOICE-NOTES] when enabling voice notes, replace the line below with:
  //   const onMicPress = voiceNote.isRecording ? voiceNote.stop : voiceNote.start;
  const onMicPress = showComingSoon;

  const baseSubtitle = DESTINATIONS.find((d) => d.value === destination)?.subtitle ?? '';
  const subtitle =
    destination === 'orbital' && selectedOrbitalIds.length > 0
      ? `Posting to ${plural(selectedOrbitalIds.length, 'orbital')}`
      : baseSubtitle;

  return (
    <>
      <ComposerFab onPress={() => dispatch(openComposer())} hasDraft={hasDraft} bottomOffset={bottomOffset} />

      <BottomSheet visible={isOpen} onClose={requestClose} dismissible>
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
              <DestinationTabs progress={progress} onSelect={changeDestination} disabled={false} />

              <DestinationPager
                progress={progress}
                orbitals={orbitals}
                orbitalsStatus={orbitalsStatus}
                selectedOrbitalIds={selectedOrbitalIds}
                onToggleOrbital={(id) => dispatch(toggleOrbital(id))}
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

              <CaptionInput value={caption} onChange={(v) => dispatch(setCaption(v))} editable />
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
          isPosting={false}
        />
      </BottomSheet>
    </>
  );
}