import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { api, getSavedPosts, removeSavedPost } from '@/components/services/savedPosts/savedPostsApi';
import type { RootState } from '../store';
import { PostcardProps } from '@/components/services/feed/postUtils';

/* ───────────── Types ───────────── */
export type SavedCard = Pick<
    PostcardProps,
    | 'id'
    | 'author'
    | 'createdAt'
    | 'content'
    | 'image'
    | 'video'
    | 'voiceNote'
    | 'voiceNoteDuration'
    | 'mediaWidth'
    | 'mediaHeight'
    | 'likesCount'
    | 'commentsCount'
    | 'isLikedByCurrentUser'
    | 'isSaved'
>;

export interface SavedItem {
    id: string;
    savedAt: string;
    card: SavedCard; // spreads straight into <Postcard {...card} />
}

type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

interface SavedState {
    ids: string[];
    byId: Record<string, SavedItem>;
    removed: Record<string, SavedItem>; // backup for optimistic unsave rollback
    status: Status;
    error: string | null;
}

const initialState: SavedState = {
    ids: [],
    byId: {},
    removed: {},
    status: 'idle',
    error: null,
};

/* ───────────── Helpers ───────────── */
export const resolveMediaUrl = (path?: string | null) => {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;
    const base = (api.defaults.baseURL ?? '').replace(/\/+$/, '');
    const root = path.startsWith('/api/') ? base.replace(/\/api$/, '') : base;
    return `${root}${path}`;
};

const errMsg = (e: unknown) =>
    axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : 'Something went wrong';

const currentUserId = (s: RootState): string | null => {
    const u = (s as any).auth?.user; // ← adjust to your auth slice
    return u?._id ?? u?.id ?? null;
};

const normalize = (entry: any, uid: string | null): SavedItem => {
    const p = entry.post;
    const likes: string[] = Array.isArray(p.likes) ? p.likes : [];
    const comments: any[] = Array.isArray(p.comments) ? p.comments : [];
    const commentsCount = comments.reduce(
        (n, c) => n + 1 + (c?.replies?.length ?? 0),
        0,
    );

    const item: SavedItem = {
        id: p._id,
        savedAt: entry.savedAt ?? p.createdAt,
        card: {
            id: p._id,
            author: {
                _id: p.author?._id,
                username: p.author?.username ?? 'unknown',
                profilePic: p.author?.profilePic,
            },
            createdAt: p.createdAt,
            content: p.content ?? '',
            image: p.image || undefined,
            video: p.video || undefined,
            voiceNote: p.voiceNote || undefined,
            voiceNoteDuration: p.voiceNoteDuration || undefined,
            likesCount: likes.length,
            commentsCount,
            isLikedByCurrentUser: !!uid && likes.includes(uid),
            isSaved: true,
        } as SavedCard,
    };
    console.log('[saved card]', item.card.image);
    return item;
};

/* ───────────── Thunks ───────────── */
export const fetchSavedPosts = createAsyncThunk<
    SavedItem[],
    void,
    { state: RootState; rejectValue: string }
>('savedPosts/fetch', async (_, { getState, rejectWithValue }) => {
    try {
        const data = await getSavedPosts();
        const uid = currentUserId(getState());
        console.log('Fetched saved posts:', data?.savedPosts);
        return (data?.savedPosts ?? [])
            .filter((e: any) => e?.post && e.post.isActive !== false && !e.post.isArchived)
            .map((e: any) => normalize(e, uid))
            .sort((a: SavedItem, b: SavedItem) => +new Date(b.savedAt) - +new Date(a.savedAt));
    } catch (e) {
        return rejectWithValue(errMsg(e));
    }
});

export const unsavePost = createAsyncThunk<string, string, { rejectValue: string }>(
    'savedPosts/unsave',
    async (postId, { rejectWithValue }) => {
        try {
            await removeSavedPost(postId);
            return postId;
        } catch (e) {
            return rejectWithValue(errMsg(e));
        }
    },
);

/* ───────────── Slice ───────────── */
const slice = createSlice({
    name: 'savedPosts',
    initialState,
    reducers: {
        /** Dispatch this from your Postcard's existing save toggle so the list stays in sync. */
        removeSaved(state, { payload: id }: { payload: string }) {
            delete state.byId[id];
            state.ids = state.ids.filter((x) => x !== id);
        },
    },
    extraReducers: (b) => {
        b.addCase(fetchSavedPosts.pending, (s) => {
            s.status = 'loading';
            s.error = null;
        })
            .addCase(fetchSavedPosts.fulfilled, (s, { payload }) => {
                s.status = 'succeeded';
                s.ids = payload.map((i) => i.id);
                s.byId = Object.fromEntries(payload.map((i) => [i.id, i]));
            })
            .addCase(fetchSavedPosts.rejected, (s, { payload }) => {
                s.status = 'failed';
                s.error = payload ?? 'Could not load saved posts';
            })
            // optimistic unsave
            .addCase(unsavePost.pending, (s, { meta }) => {
                const id = meta.arg;
                if (s.byId[id]) s.removed[id] = s.byId[id];
                delete s.byId[id];
                s.ids = s.ids.filter((x) => x !== id);
            })
            .addCase(unsavePost.fulfilled, (s, { payload }) => {
                delete s.removed[payload];
            })
            .addCase(unsavePost.rejected, (s, { meta }) => {
                const id = meta.arg;
                const backup = s.removed[id];
                if (!backup) return;
                s.byId[id] = backup;
                s.ids = [...s.ids, id].sort(
                    (a, b) => +new Date(s.byId[b].savedAt) - +new Date(s.byId[a].savedAt),
                );
                delete s.removed[id];
            });
    },
});

export const { removeSaved } = slice.actions;
export default slice.reducer;

/* ───────────── Selectors ───────────── */
export const selectSavedIds = (s: RootState) => s.savedPosts.ids;
export const selectSavedStatus = (s: RootState) => s.savedPosts.status;
export const selectSavedError = (s: RootState) => s.savedPosts.error;
export const selectSavedById = (id: string) => (s: RootState) => s.savedPosts.byId[id];
export const selectSavedCount = createSelector(selectSavedIds, (ids) => ids.length);