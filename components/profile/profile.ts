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
    friends: Friend[];
    friendStatus: FriendStatus;
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

export type ProfileTabKey = 'posts' | 'friends';