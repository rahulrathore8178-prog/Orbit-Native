import { API_URL, getAuthHeaders, getDisplayImageUrl, resolveImg } from '@/lib/utils';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/* ---------- types ---------- */
export type CommentAuthor = { _id: string; username: string; profilePic?: string };

export type CommentMedia =
    | { type: 'image' | 'gif' | 'sticker'; url: string; width?: number; height?: number }
    | { type: 'audio'; url: string; duration: number };

export type Comment = {
    _id: string;
    key?: string;
    content: string;
    createdAt: string;
    author: CommentAuthor;
    parentId: string | null;
    replyTo: { _id: string; username: string } | null;
    likeCount: number;
    liked: boolean;
    media: CommentMedia | null;
    status?: 'sending' | 'failed';
    progress?: number;
    error?: string;
};

export type Attachment =
    | { kind: 'image'; uri: string; mime: string; name: string; width: number; height: number }
    | { kind: 'voice'; uri: string; duration: number }
    | { kind: 'gif' | 'sticker'; url: string; width?: number; height?: number };

export type Draft = { content: string; attachment: Attachment | null };

/* ---------- routes (match server/src/routes/comment.routes.js) ---------- */
const BASE = `${API_URL}/api/community/posts`;
export const COMMENT_ROUTES = {
    list: (p: string) => `${BASE}/${p}/comments`,
    post: (p: string) => `${BASE}/${p}/comments`,
    reply: (p: string, c: string) => `${BASE}/${p}/${c}/commentReplies`,
    like: (p: string, c: string) => `${BASE}/${p}/${c}/likeComment`,
    remove: (p: string, c: string) => `${BASE}/${p}/comments/${c}`,
};

/* ---------- helpers ---------- */
const VOICE_EXT = Platform.OS === 'web' ? 'webm' : 'm4a';
const VOICE_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
export const MAX_COMMENT = 500;
export const MAX_VOICE_SECONDS = 60;

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
    if (Platform.OS === 'web') form.append(field, await (await fetch(file.uri)).blob(), file.name);
    else form.append(field, file as any);
}

// The server returns relative paths for audio (/api/community/comments/audio/:id); make them absolute.
const abs = (u: string) => resolveImg(u) ?? u;

function toMedia(m: any): CommentMedia | null {
    if (!m?.url) return null;
    if (m.type === 'audio') return { type: 'audio', url: abs(m.url), duration: Number(m.duration) || 0 };
    const type = m.type === 'gif' || m.type === 'sticker' ? m.type : 'image';
    return { type, url: getDisplayImageUrl(abs(m.url)), width: m.width, height: m.height };
}

export function normalizeComment(raw: any): Comment {
    const a = raw.author ?? {};
    return {
        _id: String(raw._id),
        content: raw.content ?? '',
        createdAt: raw.createdAt ?? new Date().toISOString(),
        author: { _id: String(a._id ?? ''), username: a.username ?? 'unknown', profilePic: a.profilePic },
        parentId: raw.parentId ? String(raw.parentId) : null,
        replyTo: raw.replyTo?.username ? { _id: String(raw.replyTo._id), username: raw.replyTo.username } : null,
        likeCount: raw.likeCount ?? 0,
        liked: Boolean(raw.liked),
        media: toMedia(raw.media),
    };
}

/** What the user sees instantly while the real comment uploads. */
export function makeTempComment(draft: Draft, me: CommentAuthor, rootId: string | null, target: Comment | null): Comment {
    const a = draft.attachment;
    let media: CommentMedia | null = null;
    if (a?.kind === 'image') media = { type: 'image', url: a.uri, width: a.width, height: a.height };
    else if (a?.kind === 'voice') media = { type: 'audio', url: a.uri, duration: a.duration };
    else if (a) media = { type: a.kind, url: a.url, width: a.width, height: a.height };
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
        _id: id,
        key: id,
        content: draft.content,
        createdAt: new Date().toISOString(),
        author: me,
        parentId: rootId,
        replyTo: target && target.parentId ? { _id: target.author._id, username: target.author.username } : null,
        likeCount: 0,
        liked: false,
        media,
        status: 'sending',
        progress: 0,
    };
}

/* ---------- api ---------- */
const authConfig = async () => ({ withCredentials: true, headers: { ...(await getAuthHeaders()) } });

export async function fetchComments(postId: string): Promise<Comment[]> {
    const { data } = await axios.get(COMMENT_ROUTES.list(postId), { ...(await authConfig()), timeout: 30000 });
    return (data?.comments ?? []).map(normalizeComment);
}

type PostOpts = {
    postId: string;
    draft: Draft;
    rootId: string | null;
    replyToId: string | null;
    onProgress?: (p: number) => void;
};

// One attempt. A fresh FormData is built every time, so the file is re-read on each try.
async function postCommentOnce(opts: PostOpts): Promise<{ comment: Comment; total?: number }> {
    const { postId, draft, rootId, replyToId, onProgress } = opts;
    const att = draft.attachment;
    const url = rootId ? COMMENT_ROUTES.reply(postId, rootId) : COMMENT_ROUTES.post(postId);
    const cfg = await authConfig();

    let body: FormData | Record<string, unknown>;
    let headers = cfg.headers as Record<string, string>;

    if (att && (att.kind === 'image' || att.kind === 'voice')) {
        const form = new FormData();
        form.append('content', draft.content);
        if (replyToId) form.append('replyToId', replyToId);
        if (att.kind === 'image') {
            await appendFile(form, 'image', { uri: att.uri, name: att.name, type: att.mime });
        } else {
            await appendFile(form, 'voiceNote', { uri: att.uri, name: `voice.${VOICE_EXT}`, type: VOICE_MIME });
            form.append('voiceDuration', String(att.duration));
        }
        body = form;
        // On web the browser must set the multipart boundary itself.
        if (Platform.OS !== 'web') headers = { ...headers, 'Content-Type': 'multipart/form-data' };
    } else {
        body = {
            content: draft.content,
            ...(replyToId ? { replyToId } : {}),
            ...(att ? { gifUrl: att.url, gifKind: att.kind, gifWidth: att.width, gifHeight: att.height } : {}),
        };
    }

    const { data } = await axios.post(url, body, {
        ...cfg,
        headers,
        timeout: 90000,
        onUploadProgress: (e) => { if (e.total) onProgress?.(e.loaded / e.total); },
    });
    const raw = data?.comment ?? data?.reply;
    if (!raw) throw new Error('The server did not return the comment');
    return { comment: normalizeComment(raw), total: data?.commentsCount };
}

// Retries automatically (up to 3 tries) ONLY when the request never reached the server.
// Rejections like 400/413 fail immediately, so a comment is never posted twice.
export async function postComment(opts: PostOpts): Promise<{ comment: Comment; total?: number }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await postCommentOnce(opts);
        } catch (e) {
            lastError = e;
            const noResponse = axios.isAxiosError(e) && !e.response;
            if (!noResponse) throw e;
            opts.onProgress?.(0);
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
    }
    throw lastError;
}

export async function setLikeApi(postId: string, id: string, liked: boolean) {
    const { data } = await axios.post(COMMENT_ROUTES.like(postId, id), { liked }, { ...(await authConfig()), timeout: 20000 });
    return data as { liked: boolean; likeCount: number };
}

export async function deleteCommentApi(postId: string, id: string) {
    const { data } = await axios.delete(COMMENT_ROUTES.remove(postId, id), { ...(await authConfig()), timeout: 20000 });
    return data as { removed: number; commentsCount: number };
}

/* ---------- hook ---------- */
export function useComments(postId: string | null) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const reqRef = useRef(0);

    const load = useCallback(async (mode: 'initial' | 'refresh') => {
        if (!postId) return;
        const id = ++reqRef.current;
        if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);
        try {
            setError('');
            const list = await fetchComments(postId);
            if (id === reqRef.current) setComments((prev) => [...prev.filter((c) => c.status), ...list]);
        } catch (e) {
            if (id === reqRef.current) setError(errMsg(e, 'Could not load comments'));
        } finally {
            if (id === reqRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [postId]);

    useEffect(() => {
        setComments([]);
        if (postId) load('initial');
        else {
            reqRef.current++;
            setLoading(false);
        }
    }, [postId, load]);

    const add = useCallback((c: Comment) => setComments((prev) => [c, ...prev]), []);
    const replace = useCallback(
        (tempId: string, real: Comment) =>
            setComments((prev) => prev.map((c) => (c._id === tempId ? { ...real, key: c.key ?? c._id } : c))),
        []
    );
    const removeLocal = useCallback(
        (id: string) => setComments((prev) => prev.filter((c) => c._id !== id && c.parentId !== id)),
        []
    );
    const patch = useCallback(
        (id: string, changes: Partial<Comment>) => setComments((prev) => prev.map((c) => (c._id === id ? { ...c, ...changes } : c))),
        []
    );

    return {
        comments, loading, refreshing, error,
        refresh: () => load('refresh'),
        reload: () => load('initial'),
        add, replace, removeLocal, patch,
    };
}