import { configureStore } from '@reduxjs/toolkit'
import { useDispatch } from 'react-redux'
import chatReducer from './slice/chatSlice'
import friendsReducer from './slice/friends'
import profileReducer from './slice/profileSlice'

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    profile: profileReducer,
    friends: friendsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>()


