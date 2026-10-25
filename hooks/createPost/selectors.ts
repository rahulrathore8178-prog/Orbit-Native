import type { RootLike } from '../../redux/slice/createPost/createPostSlice';

export const selectCreatePost = (s: RootLike) => s.createPost;

/** Has text or media (voice is tracked outside redux, see hooks/useVoiceNote.ts). */
export const selectHasContent = (s: RootLike) => {
  const { caption, media } = s.createPost;
  return caption.trim().length > 0 || !!media;
};
