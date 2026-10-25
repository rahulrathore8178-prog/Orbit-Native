/**
 * Single place that points at code OUTSIDE this feature folder.
 * If your project layout differs, this is the only file you need to touch.
 *
 * Assumption: the `CreatePost/` folder sits in the same directory where the old
 * `CreatePost.tsx` used to live (next to `postConstant.ts` and `PostMedia.tsx`,
 * and one level below `components/orbital/`).
 */

// app utils
export { API_URL, getAuthHeaders } from '@/lib/utils';

// orbitals
export { fetchMyOrbitals, resolveUrl } from '@/components/orbital/orbitalData';
export type { MyOrbital } from '@/components/orbital/orbitalData';

// shared post constants (unchanged from your existing file)
export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ANALYSIS_PROMPT,
  MAX_CAPTION,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  resolveMime,
} from '@/components/posts/postConstant';

// existing media preview components
export { VideoPreview } from '@/components/posts/PostMedia';

// [VOICE-NOTES] uncomment when voice notes are enabled
// export { MAX_RECORDING_SECONDS } from '../postConstant';
// export { RecordingBar, VoiceNotePreview } from '../PostMedia';
