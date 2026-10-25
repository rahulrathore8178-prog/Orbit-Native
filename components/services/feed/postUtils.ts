import type { ShareTarget } from '@/components/posts/ShareModal';
import { authStorage } from '@/lib/auth/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, resolveImg } from '@/lib/utils';

/* ------------------------------- types -------------------------------- */

export interface PostAuthor {
    id?: string;
    username: string;
    profilePic?: string;
}

export interface PostcardProps {
    id: string;
    author: PostAuthor;
    createdAt: string | number | Date;
    content?: string;
    image?: string;
    video?: string;
    voiceNote?: string;
    voiceNoteDuration?: number;
    mediaWidth?: number;
    mediaHeight?: number;
    likesCount: number;
    commentsCount: number;
    isLikedByCurrentUser: boolean;
    isSaved?: boolean;
    isOwn?: boolean;
    /** Set on posts that belong to an orbital. */
    orbital?: { id?: string; name?: string; image?: string };
    /** Pass from a FlatList viewability callback to auto-pause off-screen media. */
    isVisible?: boolean;
    onPressComments?: () => void;
    onClickShare?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export type ApiPost = Partial<PostcardProps> & {
    _id?: string;
    user?: PostAuthor;
    isSavedByCurrentUser?: boolean;
    savedByCurrentUser?: boolean;
};

export type StoredUser = {
    id?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    profilePic?: string;
    friends?: string[];
    orbitals?: string[];
};

/* ------------------------------- auth --------------------------------- */

export const getAuthHeaders = async () => {
    const token = (await authStorage.getToken()) ?? (await AsyncStorage.getItem('user'));
    return { Authorization: `Bearer ${token}` };
};

/* ------------------------------ formatters ---------------------------- */

export const formatTimeAgo = (createdAt: string | number | Date): string => {
    const then = new Date(createdAt).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.floor(days / 365)}y`;
};

export const formatCount = (count: number): string => {
    if (count < 1000) return `${count}`;
    if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0)}k`;
    return `${(count / 1_000_000).toFixed(1)}M`;
};

export const formatDuration = (seconds?: number): string => {
    const total = Math.max(0, Math.floor(seconds ?? 0));
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
};

/* ------------------------------ waveform ------------------------------ */

export const hashSeed = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const seededRandom = (seed: number) => {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
};

export const buildWaveform = (seed: number, bars = 40): number[] => {
    const rand = seededRandom(seed || 1);
    return Array.from({ length: bars }, () => 0.25 + rand() * 0.75);
};

/* ------------------------------- media -------------------------------- */

// Feed cards read best between a tall 4:5 portrait and a wide 1.91:1 landscape.
const MIN_ASPECT_RATIO = 4 / 5;
const MAX_ASPECT_RATIO = 1.91;
export const clampAspectRatio = (ratio: number): number =>
    Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));

/** Server-relative paths ("/uploads/..") get the API host prepended. */
export const withHost = (path?: string) => (path?.startsWith('/') ? `${API_URL}${path}` : path);

export const stripHost = (p?: string) => (p ? p.replace(/^https?:\/\/[^/]+/, '') : p);

/* ------------------------------ mappers ------------------------------- */

export const toPostcardProps = (post: ApiPost): PostcardProps => ({
    id: post.id ?? post._id ?? `post-${Date.now()}`,
    author: post.author ?? post.user ?? { username: 'Unknown' },
    createdAt: post.createdAt ?? new Date().toISOString(),
    content: post.content ?? '',
    image: post.image,
    video: post.video,
    voiceNote: post.voiceNote,
    voiceNoteDuration: post.voiceNoteDuration,
    mediaWidth: post.mediaWidth,
    mediaHeight: post.mediaHeight,
    likesCount: post.likesCount ?? 0,
    commentsCount: post.commentsCount ?? 0,
    isLikedByCurrentUser: post.isLikedByCurrentUser ?? false,
    isSaved: post.isSaved ?? post.isSavedByCurrentUser ?? post.savedByCurrentUser ?? false,
    isOwn: post.isOwn,
    orbital: post.orbital,
});

export const toShareTarget = (u: any): ShareTarget => ({
    id: String(u?._id ?? u?.id),
    name: u?.name ?? u?.username ?? 'Unknown',
    username: u?.username,
    avatar: u?.profilePic ? resolveImg(u.profilePic) : undefined,
    memberCount: u?.memberCount ?? u?.members?.length,
});

export const toList = (data: any, key: string): any[] =>
    Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];