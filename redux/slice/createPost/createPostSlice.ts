import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getErrorMessage, sendPost } from '../../../components/services/createPost/postApi';
import { MAX_CAPTION, fetchMyOrbitals, type MyOrbital } from '../../../constants/createPost/external';
import type { Destination, PickedMedia, SubmitResult, Voice } from '../../../constants/createPost/types';

/* ---------- state ---------- */
export interface CreatePostState {
  isOpen: boolean;
  destination: Destination;
  caption: string;
  media: PickedMedia | null;
  selectedOrbitalIds: string[];
  orbitals: MyOrbital[] | null;
  orbitalsStatus: 'idle' | 'loading' | 'failed';
  /** number of posts currently uploading in the background */
  postingCount: number;
  error: string;
}

/** Shape the thunks need from your root state: just add `createPost: createPostReducer` to your store. */
export type RootLike = { createPost: CreatePostState };

/** Snapshot of the composer taken at the moment Post is tapped. */
export type PostDraft = {
  destination: Destination;
  caption: string;
  media: PickedMedia | null;
  orbitalIds: string[];
  voice?: Voice | null;
};

const initialState: CreatePostState = {
  isOpen: false,
  destination: 'feed',
  caption: '',
  media: null,
  selectedOrbitalIds: [],
  orbitals: null,
  orbitalsStatus: 'idle',
  postingCount: 0,
  error: '',
};

/* ---------- thunks ---------- */
export const loadOrbitals = createAsyncThunk<MyOrbital[], void, { state: RootLike }>(
  'createPost/loadOrbitals',
  async () => fetchMyOrbitals(),
  { condition: (_, { getState }) => getState().createPost.orbitalsStatus !== 'loading' },
);

/**
 * Runs in the background: the composer is already closed and cleared by the `pending` reducer,
 * so everything the request needs comes from the `draft` snapshot, never from live state.
 */
export const submitPost = createAsyncThunk<SubmitResult, PostDraft, { rejectValue: string }>(
  'createPost/submit',
  async (draft, { rejectWithValue }) => {
    const caption = draft.caption.trim();
    const voice = draft.voice ?? null;
    const orbitalIds = draft.orbitalIds ?? [];

    if (draft.destination === 'orbital' && !orbitalIds.length) return rejectWithValue('Select at least one orbital');
    if (!caption && !draft.media && !voice) return rejectWithValue('Write something or attach a photo or video');
    if (draft.caption.length > MAX_CAPTION) return rejectWithValue(`Exceeds ${MAX_CAPTION} chars`);

    try {
      return await sendPost({
        destination: draft.destination,
        caption,
        media: draft.media,
        voice,
        orbitalIds,
      });
    } catch (e) {
      return rejectWithValue(getErrorMessage(e, e instanceof Error ? e.message : 'Post failed'));
    }
  },
);

/* ---------- slice ---------- */
const slice = createSlice({
  name: 'createPost',
  initialState,
  reducers: {
    openComposer(state) {
      state.isOpen = true;
    },
    closeComposer(state) {
      state.isOpen = false;
    },
    setDestination(state, { payload }: PayloadAction<Destination>) {
      state.destination = payload;
      state.error = '';
    },
    setCaption(state, { payload }: PayloadAction<string>) {
      state.caption = payload;
    },
    setMedia(state, { payload }: PayloadAction<PickedMedia>) {
      state.media = payload;
      state.error = '';
    },
    clearMedia(state) {
      state.media = null;
    },
    /** Select if unselected, unselect if selected. */
    toggleOrbital(state, { payload }: PayloadAction<string>) {
      const ids = state.selectedOrbitalIds ?? [];
      state.selectedOrbitalIds = ids.includes(payload) ? ids.filter((id) => id !== payload) : [...ids, payload];
      state.error = '';
    },
    setError(state, { payload }: PayloadAction<string>) {
      state.error = payload;
    },
    clearError(state) {
      state.error = '';
    },
  },
  extraReducers: (builder) => {
    builder
      // orbitals
      .addCase(loadOrbitals.pending, (state) => {
        state.orbitalsStatus = 'loading';
      })
      .addCase(loadOrbitals.fulfilled, (state, { payload }) => {
        state.orbitals = payload;
        state.orbitalsStatus = 'idle';
        const valid = new Set(payload.map((o) => o._id));
        state.selectedOrbitalIds = (state.selectedOrbitalIds ?? []).filter((id) => valid.has(id));
        // only one orbital? pick it for them (they can still unselect it)
        if (payload.length === 1 && !state.selectedOrbitalIds.length) state.selectedOrbitalIds = [payload[0]._id];
      })
      .addCase(loadOrbitals.rejected, (state) => {
        state.orbitalsStatus = 'failed';
      })
      // posting: close + clear immediately, upload continues in the background
      .addCase(submitPost.pending, (state) => {
        state.postingCount = (state.postingCount ?? 0) + 1;
        state.isOpen = false;
        state.caption = '';
        state.media = null;
        state.error = '';
      })
      .addCase(submitPost.fulfilled, (state) => {
        state.postingCount = Math.max(0, (state.postingCount ?? 1) - 1);
      })
      .addCase(submitPost.rejected, (state, action) => {
        state.postingCount = Math.max(0, (state.postingCount ?? 1) - 1);
        // give the draft back, unless the person has already started a new one
        if (!state.caption && !state.media) {
          const d = action.meta.arg;
          state.caption = d.caption;
          state.media = d.media;
          state.destination = d.destination;
          state.selectedOrbitalIds = d.orbitalIds ?? [];
          state.error = action.payload ?? action.error.message ?? 'Post failed';
        }
      });
  },
});

export const {
  openComposer,
  closeComposer,
  setDestination,
  setCaption,
  setMedia,
  clearMedia,
  toggleOrbital,
  setError,
  clearError,
} = slice.actions;

export default slice.reducer;