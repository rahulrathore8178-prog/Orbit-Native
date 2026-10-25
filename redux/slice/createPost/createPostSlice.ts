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
  selectedOrbitalId: string | null;
  orbitals: MyOrbital[] | null;
  orbitalsStatus: 'idle' | 'loading' | 'failed';
  status: 'idle' | 'posting';
  error: string;
}

/** Shape the thunks need from your root state: just add `createPost: createPostReducer` to your store. */
export type RootLike = { createPost: CreatePostState };

const initialState: CreatePostState = {
  isOpen: false,
  destination: 'feed',
  caption: '',
  media: null,
  selectedOrbitalId: null,
  orbitals: null,
  orbitalsStatus: 'idle',
  status: 'idle',
  error: '',
};

/* ---------- thunks ---------- */
export const loadOrbitals = createAsyncThunk<MyOrbital[], void, { state: RootLike }>(
  'createPost/loadOrbitals',
  async () => fetchMyOrbitals(),
  { condition: (_, { getState }) => getState().createPost.orbitalsStatus !== 'loading' },
);

type SubmitArg = { voice?: Voice | null } | undefined;

export const submitPost = createAsyncThunk<SubmitResult, SubmitArg, { state: RootLike; rejectValue: string }>(
  'createPost/submit',
  async (arg, { getState, rejectWithValue }) => {
    const { caption, media, destination, selectedOrbitalId } = getState().createPost;
    const voice = arg?.voice ?? null;
    const trimmed = caption.trim();

    if (destination === 'orbital' && !selectedOrbitalId) return rejectWithValue('Select an orbital first');
    if (!trimmed && !media && !voice) return rejectWithValue('Write something or attach a photo or video');
    if (caption.length > MAX_CAPTION) return rejectWithValue(`Exceeds ${MAX_CAPTION} chars`);

    try {
      return await sendPost({ destination, caption: trimmed, media, voice, orbitalId: selectedOrbitalId });
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
    selectOrbital(state, { payload }: PayloadAction<string>) {
      state.selectedOrbitalId = payload;
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
        // only one orbital? pick it for them
        if (payload.length === 1 && !state.selectedOrbitalId) state.selectedOrbitalId = payload[0]._id;
      })
      .addCase(loadOrbitals.rejected, (state) => {
        state.orbitalsStatus = 'failed';
      })
      // posting
      .addCase(submitPost.pending, (state) => {
        state.status = 'posting';
        state.error = '';
      })
      .addCase(submitPost.fulfilled, (state) => {
        state.status = 'idle';
        state.isOpen = false;
        state.caption = '';
        state.media = null;
        state.error = '';
      })
      .addCase(submitPost.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? action.error.message ?? 'Post failed';
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
  selectOrbital,
  setError,
  clearError,
} = slice.actions;

export default slice.reducer;
