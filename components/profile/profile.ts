export type FriendStatus =
    | 'none'
    | 'friends'
    | 'request_sent'
    | 'request_received'
    | 'self';

export type ProfileUser = {
    id: string;
    username: string;
    handle: string; // includes the leading @
    bio: string;
    profilePic?: string;
    phone?: string;
    friends: Friend[];
    friendStatus: FriendStatus;
    /** Private profiles hide posts from non-friends. Own profile uses this to show the Requests tab. */
    isPrivate: boolean;
};

export type ProfilePost = {
    id: string;
    content: string;
    image?: string;
    video?: string;
    voiceNote?: string;
    voiceNoteDuration?: number;
    mediaWidth?: number;
    mediaHeight?: number;
    createdAt?: string;
    updatedAt: string;
    likesCount: number;
    commentsCount: number;
    likedBy?: string[];
    isLikedByCurrentUser?: boolean;
    isSaved?: boolean;
};

export type Friend = {
    id: string;
    username: string;
    profilePic?: string;
};

/** Incoming friend request. `requestId` is the request's own _id: accept/reject use it, NOT the user id. */
export type FriendRequest = {
    requestId: string;
    user: Friend;
    createdAt?: string;
};

export type ProfileTabKey = 'posts' | 'friends' | 'requests';