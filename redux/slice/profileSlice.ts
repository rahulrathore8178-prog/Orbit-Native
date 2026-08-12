import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PostState {
  id: string;
  content: string;
  image: string;
  likesCount: number;
  updatedAt: number;
  commentsCount: number;
}

interface ProfileState {
  name: string;
  profilePicture?: string;
  posts: PostState[];
  // current authenticated user id (null when logged out)
  currentUserId: string | null;
}

const profileSlice = createSlice({
  name: 'profile',
  initialState: {
    name: '',
    posts: [],
    currentUserId: null,
  } as ProfileState,
  reducers: {
    updateProfile: (state, action: PayloadAction<Partial<ProfileState>>) => {
      return { ...state, ...action.payload };
    },
    setPosts: (state, action: PayloadAction<PostState[]>) => {
      state.posts = action.payload;
    },
    setUserId: (state, action: PayloadAction<string | null>) => {
      state.currentUserId = action.payload;
    },
    resetProfile: (state) => {
      state.name = '';
      state.profilePicture = undefined;
      state.posts = [];
      state.currentUserId = null;
    },
  },
});

export const { updateProfile, setPosts, setUserId, resetProfile } = profileSlice.actions;
export default profileSlice.reducer;
