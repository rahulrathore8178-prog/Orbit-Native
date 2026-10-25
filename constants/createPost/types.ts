/** Where a post goes. (`both` was removed for now, see constants.ts to bring it back.) */
export type Destination = 'feed' | 'orbital';

/** What the backend actually receives. */
export type PostTarget = 'feed' | 'orbital';

export type PickedMedia = {
  uri: string;
  kind: 'image' | 'video';
  mime: string;
  name: string;
};

/** Recorded voice note (feature is dormant, see hooks/useVoiceNote.ts). */
export type Voice = { uri: string; duration: number };

export type CurrentUser = {
  username?: string;
  profilePic?: string;
  avatar?: string;
  [key: string]: unknown;
};

export type CreatedPost = { target: PostTarget; post: any };
export type FailedPost = { target: PostTarget; message: string };
export type SubmitResult = { created: CreatedPost[]; failed: FailedPost[] };

export type CreatePostProps = {
  /** called once per created post; `target` says whether it went to the feed or an orbital */
  onPostCreated?: (post: any, target: PostTarget) => void;
  /** current user. If omitted (or without a photo) we fall back to the user saved in AsyncStorage. */
  user?: CurrentUser;
  /** distance of the floating + button from the bottom of the parent view */
  bottomOffset?: number;
};
