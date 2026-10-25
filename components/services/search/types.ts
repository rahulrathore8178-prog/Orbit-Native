export interface User {
    _id: string;
    username: string;
    profilePic?: string;
    isFriend?: boolean;
    /** I sent them a request (outgoing) */
    requestSent?: boolean;
    /** They sent me a request (incoming) */
    hasPendingRequest?: boolean;
}

export interface FriendActions {
    addFriend: (user: User) => void;
    cancelRequest: (user: User) => void;
    acceptRequest: (user: User) => void;
    rejectRequest: (user: User) => void;
}