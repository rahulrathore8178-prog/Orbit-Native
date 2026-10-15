import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import axios from 'axios';
import { API_URL, getAuthHeaders } from '@/app/utils';
import { resolveUrl } from '../orbital/orbitalData';

/* ---------- types ---------- */
export type CommentAuthor = { _id: string; username: string; profilePic?: string };

export type CommentMedia =
    | { type: 'image'; url: string }
    | { type: 'video'; url: string }
    | { type: 'audio'; url: string; duration: number }
    | { type: 'gif'; url: string };

export type Comment = {
    _id: string;
    content: string;
    createdAt: string;
    author: CommentAuthor;
    parentId: string | null;
    likeCount: number;
    liked: boolean;
    media: CommentMedia | null;
};

export type Attachment =
    | { kind: 'image' | 'video'; uri: string; mime: string; name: string }
    | { kind: 'voice'; uri: string; duration: number }
    | { kind: 'gif'; url: string };

export type Draft = { content: string; attachment: Attachment | null };

/* ---------- routes: TODO adjust to your backend ---------- */
export const COMMENT_ROUTES = {
    list: (postId: string) => `${API_URL}/api/community/posts/${postId}`,
    post: (postId: string) => `${API_URL}/api/community/posts/${postId}/comments`,
    like: (commentId: string) => `${API_URL}/api/community/comments/${commentId}/like`,
    remove: (commentId: string) => `${API_URL}/api/community/comments/${commentId}`,
};

/* ---------- helpers ---------- */
const VOICE_EXT = Platform.OS === 'web' ? 'webm' : 'm4a';
const VOICE_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
const AUDIO_URL_RE = /\.(m4a|mp3|aac|wav|ogg|oga|opus)(\?|$)/i;
const VIDEO_URL_RE = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export const errMsg = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ?? fallback;

export function timeAgo(iso: string) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'now';
    const m = s / 60;
    if (m < 60) return `${Math.floor(m)}m`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h`;
    const d = h / 24;
    if (d < 7) return `${Math.floor(d)}d`;
    return new Date(iso).toLocaleDateString();
}

async function appendFile(form: FormData, field: string, file: { uri: string; name: string; type: string }) {
    if (Platform.OS === 'web') {
        form.append(field, await (await fetch(file.uri)).blob(), file.name);
    } else {
        form.append(field, file as any);
    }
}

/* ---------- the ONE place that knows your response shape ---------- */
function toMedia(raw: any): CommentMedia | null {
    if (raw.gifUrl) return { type: 'gif', url: raw.gifUrl };
    const rawUrl: string | undefined =
        raw.mediaUrl ?? raw.media?.url ?? (typeof raw.media === 'string' ? raw.media : undefined);
    if (!rawUrl) return null;
    const url = resolveUrl(rawUrl) ?? rawUrl;
    const t: string | undefined = raw.mediaType ?? raw.media?.type;

    if (t?.startsWith('audio') || raw.voiceNoteDuration || AUDIO_URL_RE.test(url)) {
        return { type: 'audio', url, duration: Number(raw.voiceNoteDuration ?? raw.media?.duration ?? 0) };
    }
    if (t?.startsWith('video') || VIDEO_URL_RE.test(url)) return { type: 'video', url };
    return { type: 'image', url };
}

export function normalizeComment(raw: any, myId?: string, fallback?: CommentAuthor): Comment {
    const a = raw.author ?? raw.user ?? fallback ?? {};
    const likes: any[] | null = Array.isArray(raw.likes) ? raw.likes : null;
    const parent = raw.parentId ?? raw.parent;
    return {
        _id: String(raw._id ?? raw.id),
        content: raw.content ?? raw.text ?? '',
        createdAt: raw.createdAt ?? new Date().toISOString(),
        author: {
            _id: String(a._id ?? a.id ?? ''),
            username: a.username ?? 'unknown',
            profilePic: a.profilePic ?? a.avatar,
        },
        parentId: parent ? String(parent._id ?? parent) : null,
        likeCount: raw.likeCount ?? likes?.length ?? 0,
        liked:
            raw.liked ??
            raw.isLiked ??
            (likes && myId ? likes.some((l) => String(l?._id ?? l) === myId) : false),
        media: toMedia(raw),
    };
}

/* ---------- api ---------- */
const authConfig = async () => ({ withCredentials: true, headers: { ...(await getAuthHeaders()) } });

export async function fetchComments(postId: string, myId?: string) {
    const { data } = await axios.get(COMMENT_ROUTES.list(postId), await authConfig());
    const list: any[] = Array.isArray(data) ? data : data?.post?.comments ?? [];
    return list.map((r) => normalizeComment(r, myId));
}

export async function createComment(
    postId: string,
    draft: Draft,
    parentId: string | null,
    me: CommentAuthor
): Promise<Comment> {
    // Your comments endpoint only parses JSON (no multer), same as the web app,
    // so media can't be sent until the backend supports it.
    if (draft.attachment) throw new Error('Attachments are not supported by the server yet');
    const { data } = await axios.post(
        COMMENT_ROUTES.post(postId),
        { content: draft.content, ...(parentId ? { parentId } : {}) },
        await authConfig()
    );

    const raw = data?.comment ?? data?.data?.comment;
    if (!raw) throw new Error('The server did not return the new comment');
    return normalizeComment(raw, me._id, me);
}

export const toggleLikeApi = async (commentId: string) => {
    await axios.post(COMMENT_ROUTES.like(commentId), {}, await authConfig());
};

export const deleteCommentApi = async (commentId: string) => {
    await axios.delete(COMMENT_ROUTES.remove(commentId), await authConfig());
};

/* ---------- hook ---------- */
export function useComments(postId: string | null, myId?: string) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const reqRef = useRef(0);

    const load = useCallback(
        async (mode: 'initial' | 'refresh') => {
            if (!postId) return;
            const id = ++reqRef.current;
            if (mode === 'refresh') setRefreshing(true);
            else setLoading(true);
            try {
                setError('');
                const list = await fetchComments(postId);
                if (id === reqRef.current) setComments(list);
            } catch (e) {
                if (id === reqRef.current) setError(errMsg(e, 'Could not load comments'));
            } finally {
                if (id === reqRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [postId, myId]
    );

    useEffect(() => {
        setComments([]);
        if (postId) load('initial');
        else {
            reqRef.current++;
            setLoading(false);
        }
    }, [postId, load]);

    const add = (c: Comment) => setComments((prev) => [c, ...prev]);
    const removeLocal = (id: string) => setComments((prev) => prev.filter((c) => c._id !== id && c.parentId !== id));
    const patch = (id: string, changes: Partial<Comment>) =>
        setComments((prev) => prev.map((c) => (c._id === id ? { ...c, ...changes } : c)));

    return {
        comments,
        loading,
        refreshing,
        error,
        refresh: () => load('refresh'),
        reload: () => load('initial'),
        add,
        removeLocal,
        patch,
    };
}