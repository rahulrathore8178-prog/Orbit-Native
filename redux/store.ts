import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import authReducer, { signOut } from './slice/authSlice';
import chatReducer from './slice/chatSlice';
import profileReducer from './slice/profileSlice';
import friendsReducer from './slice/friends';
import discoverReducer from './slice/discoverSlice';
import savedPostsReducer from './slice/savedPostsSlice'; 
import createPostReducer from './slice/createPost/createPostSlice';
import notificationsReducer from './slice/notifications/notificationsSlice';
import archivedPostsReducer from'./slice/archivedPosts/archivedPostsSlice'
import chatBadgeReducer from './slice/chatBadgeSlice';

const appReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  profile: profileReducer,
  friends: friendsReducer,
  discover: discoverReducer,
  savedPosts: savedPostsReducer,
  createPost: createPostReducer,
  notifications: notificationsReducer,
  archivedPosts: archivedPostsReducer,
  chatBadge: chatBadgeReducer,
});

// On logout, wipe every slice so the next user never sees the previous user's chats, friends or profile.
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) =>
  action.type === signOut.fulfilled.type ? appReducer(undefined, action) : appReducer(state, action);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;