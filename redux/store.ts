import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import authReducer, { signOut } from './slice/authSlice'; // adjust path if your slices live elsewhere
import chatReducer from './slice/chatSlice';               // keep your existing imports as they are
import profileReducer from './slice/profileSlice';
import friendsReducer from './slice/friends';
import discoverReducer from './slice/discover';

const appReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  profile: profileReducer,
  friends: friendsReducer,
  discover: discoverReducer,
});

// On logout, wipe every slice so the next user never sees the previous user's chats, friends or profile.
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) =>
  action.type === signOut.fulfilled.type ? appReducer(undefined, action) : appReducer(state, action);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;