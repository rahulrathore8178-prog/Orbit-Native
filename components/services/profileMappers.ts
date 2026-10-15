import { API_URL } from '@/app/utils'; // adjust to wherever you export API_URL today
import { Friend, FriendStatus, ProfilePost, ProfileUser } from '@/components/profile/profile';

export const resolveUri = (uri?: string) =>
    uri ? (uri.startsWith('http') ? uri : `${API_URL}${uri.startsWith('/') ? '' : '/'}${uri}`) : undefined;

const FRIEND_STATUSES: FriendStatus[] = [
    'none', 'friends', 'request_sent', 'request_received', 'self',
];
export const toHandle = (name = '') => `@${name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

export const toProfileUser = (raw: any): ProfileUser => ({
    id: raw?._id ?? raw?.id ?? '',
    username: raw?.username ?? '',
    handle: raw?.handle ? `@${String(raw.handle).replace(/^@/, '')}` : toHandle(raw?.username),
    bio: raw?.bio ?? '',
    profilePic: resolveUri(raw?.profilePic),
    friendStatus: FRIEND_STATUSES.includes(raw?.friendStatus) ? raw?.friendStatus : 'none',
    friends: (raw?.friends) ? raw?.friends.map(toFriend) : [],
});

export const toProfilePost = (raw: any): ProfilePost => ({
    id: raw?._id ?? raw?.id,
    content: raw?.content ?? '',
    image: resolveUri(raw?.image),
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? new Date().toISOString(),
    likesCount: raw?.likesCount ?? raw?.likes?.length ?? 0,
    commentsCount: raw?.commentsCount ?? raw?.comments?.length ?? 0,
});

export const toFriend = (raw: any): Friend => ({
    id: raw?._id ?? raw?.id ?? '',
    username: raw?.username ?? '',
    profilePic: resolveUri(raw?.profilePic),
});