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
    updatedAt: string;
    likesCount: number;
    commentsCount: number;
};

export type Friend = {
    id: string;
    username: string;
    profilePic?: string;
};

export type ProfileTabKey = 'posts' | 'friends';