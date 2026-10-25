import { Friend, FriendStatus, ProfilePost, ProfileUser } from '@/components/profile/profile';
import { API_URL } from '@/lib/utils'; // adjust to wherever you export API_URL today

export const resolveUri = (uri?: string) =>
    uri ? (uri.startsWith('http') ? uri : `${API_URL}${uri.startsWith('/') ? '' : '/'}${uri}`) : undefined;

const FRIEND_STATUSES: FriendStatus[] = [
    'none', 'friends', 'request_sent', 'request_received', 'self',
];
export const toHandle = (name = '') => `@${name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

// Ids come back either as plain strings or as populated objects.
const idOf = (v: any): string => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');

export const toFriend = (raw: any): Friend => ({
    id: idOf(raw),
    username: raw?.username ?? '',
    profilePic: resolveUri(raw?.profilePic),
});

export const toProfileUser = (raw: any): ProfileUser => ({
    id: raw?._id ?? raw?.id ?? '',
    username: raw?.username ?? '',
    handle: raw?.handle ? `@${String(raw.handle).replace(/^@/, '')}` : toHandle(raw?.username),
    bio: raw?.bio ?? '',
    profilePic: resolveUri(raw?.profilePic),
    friendStatus: FRIEND_STATUSES.includes(raw?.friendStatus) ? raw?.friendStatus : 'none',
    // friends may arrive as bare id strings; drop entries with no usable id
    friends: (raw?.friends ?? []).map(toFriend).filter((f: Friend) => f.id),
});

export const toProfilePost = (raw: any): ProfilePost => ({
    id: raw?._id ?? raw?.id,
    content: raw?.content ?? '',
    image: resolveUri(raw?.image),
    // video / voice note stay as raw backend paths: Postcard adds the host itself (withHost),
    // exactly like in the feed.
    video: raw?.video || undefined,
    voiceNote: raw?.voiceNote || undefined,
    voiceNoteDuration: raw?.voiceNoteDuration || undefined,
    mediaWidth: raw?.mediaWidth,
    mediaHeight: raw?.mediaHeight,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? new Date().toISOString(),
    likesCount: raw?.likesCount ?? raw?.likes?.length ?? 0,
    commentsCount: raw?.commentsCount ?? raw?.comments?.length ?? 0,
    // who liked it, so useProfile can work out "did I like this"
    likedBy: Array.isArray(raw?.likes) ? raw.likes.map(idOf) : undefined,
    isLikedByCurrentUser: raw?.isLikedByCurrentUser ?? raw?.isLiked,
    isSaved: raw?.isSaved ?? raw?.isSavedByCurrentUser,
});