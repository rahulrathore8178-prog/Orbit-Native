export interface CapsuleUser {
  id: string;
  username: string;
  avatar?: string;
}

export interface Capsule {
  id: string;
  mediaUrl: string;
  createdAt: string; // ISO
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  seen: boolean; // has the current user seen it
  caption: string;
  viewers?: CapsuleViewerEntry[]; // optional, only for the capsule details view
  comments?: RawCapsuleComment[];
}

export interface RawCapsuleComment {
  id?: string;
  _id?: string;
  content?: string;
  createdAt: string;
  author?: { id?: string; _id?: string; username: string; profilePic?: string };
  voiceNote?: { url: string; duration: number };
  likesCount?: number;
}

export interface CapsuleGroup {
  user: CapsuleUser;
  capsules: Capsule[]; // oldest -> newest
}

export interface CapsuleFeed {
  me: CapsuleUser;
  mine: Capsule[];
  groups: CapsuleGroup[];
}

export interface CapsuleComment {
  id: string;
  user: CapsuleUser;
  text: string;
  createdAt: string;
}

export interface CapsuleViewerEntry {
  id: string;
  username: string;
  profilePic: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
