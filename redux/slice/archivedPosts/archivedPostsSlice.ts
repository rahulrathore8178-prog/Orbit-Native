import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { profileApi } from '@/components/services/profileApi';
import type { SavedCard } from '../savedPostsSlice';
import type { RootState } from '../../store';

/** Same shape as the saved-posts slice, so the grid tile and the post screen work the same way. */
export interface ArchivedItem {
    id: string;
    archivedAt: string;
    card: SavedCard; // spreads straight into <Postcard {...card} />
}

type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ArchivedState {
    ids: string[];
    byId: Record<string, ArchivedItem>;
    removed: Record<string, ArchivedItem>; // backup for optimistic unarchive rollback
    status: Status;
    error: string | null;
}

const initialState: ArchivedState = { ids: [], byId: {}, removed: {}, status: 'idle', error: null };

export const fetchArchivedPosts = createAsyncThunk<ArchivedItem[], void, { rejectValue: string }>(
    'archivedPosts/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const { me, posts } = await profileApi.getArchivedPosts();
            return posts.map((p) => ({
                id: p.id,
                archivedAt: p.updatedAt ?? p.createdAt ?? new Date().toISOString(),
                card: {
                    id: p.id,
                    author: { id: me.id, username: me.username, profilePic: me.profilePic },
                    createdAt: p.createdAt ?? p.updatedAt,
                    content: p.content ?? '',
                    image: p.image,
                    video: p.video,
                    voiceNote: p.voiceNote,
                    voiceNoteDuration: p.voiceNoteDuration,
                    mediaWidth: p.mediaWidth,
                    mediaHeight: p.mediaHeight,
                    likesCount: p.likesCount ?? 0,
                    commentsCount: p.commentsCount ?? 0,
                    isLikedByCurrentUser: p.likes.includes(me.id),
                    isSaved: false,
                } as SavedCard,
            }));
        } catch (e: any) {
            return rejectWithValue(e?.response?.data?.message ?? e?.message ?? 'Could not load archived posts');
        }
    },
);

export const unarchivePost = createAsyncThunk<string, string, { rejectValue: string }>(
    'archivedPosts/unarchive',
    async (postId, { rejectWithValue }) => {
        try {
            await profileApi.archivePost(postId, false);
            return postId;
        } catch (e: any) {
            return rejectWithValue(e?.response?.data?.message ?? e?.message ?? 'Could not unarchive');
        }
    },
);

const slice = createSlice({
    name: 'archivedPosts',
    initialState,
    reducers: {},
    extraReducers: (b) => {
        b.addCase(fetchArchivedPosts.pending, (s) => {
            s.status = 'loading';
            s.error = null;
        })
            .addCase(fetchArchivedPosts.fulfilled, (s, { payload }) => {
                s.status = 'succeeded';
                s.ids = payload.map((i) => i.id);
                s.byId = Object.fromEntries(payload.map((i) => [i.id, i]));
            })
            .addCase(fetchArchivedPosts.rejected, (s, { payload }) => {
                s.status = 'failed';
                s.error = payload ?? 'Could not load archived posts';
            })
            // optimistic unarchive
            .addCase(unarchivePost.pending, (s, { meta }) => {
                const id = meta.arg;
                if (s.byId[id]) s.removed[id] = s.byId[id];
                delete s.byId[id];
                s.ids = s.ids.filter((x) => x !== id);
            })
            .addCase(unarchivePost.fulfilled, (s, { payload }) => {
                delete s.removed[payload];
            })
            .addCase(unarchivePost.rejected, (s, { meta }) => {
                const id = meta.arg;
                const backup = s.removed[id];
                if (!backup) return;
                s.byId[id] = backup;
                s.ids = [...s.ids, id].sort(
                    (a, b) => +new Date(s.byId[b].card.createdAt as any) - +new Date(s.byId[a].card.createdAt as any),
                );
                delete s.removed[id];
            });
    },
});

export default slice.reducer;

export const selectArchivedIds = (s: RootState) => s.archivedPosts.ids;
export const selectArchivedStatus = (s: RootState) => s.archivedPosts.status;
export const selectArchivedError = (s: RootState) => s.archivedPosts.error;
export const selectArchivedById = (id: string) => (s: RootState) => s.archivedPosts.byId[id];