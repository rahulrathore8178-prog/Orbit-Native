import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import authReducer, { signIn, switchAccount, removeAccount, signOut, signOutAll } from './slice/authSlice';
import chatReducer from './slice/chatSlice';
import profileReducer from './slice/profileSlice';
import friendsReducer from './slice/friends';
import discoverReducer from './slice/discoverSlice';
import savedPostsReducer from './slice/savedPostsSlice'; 
import createPostReducer from './slice/createPost/createPostSlice';
import notificationsReducer from './slice/notifications/notificationsSlice';
import archivedPostsReducer from'./slice/archivedPosts/archivedPostsSlice'
import chatBadgeReducer from './slice/chatBadgeSlice';

const ACCOUNT_ACTIONS = [signIn, switchAccount, removeAccount, signOut, signOutAll].map((a) => a.fulfilled.type);

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
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) => {
  if (state && ACCOUNT_ACTIONS.includes(action.type)) {
    const next = (action as any).payload?.activeAccountId ?? null;
    if (next !== state.auth.activeAccountId) {
      return appReducer({ auth: state.auth } as any, action);
    }
  }
  return appReducer(state, action);
};

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;