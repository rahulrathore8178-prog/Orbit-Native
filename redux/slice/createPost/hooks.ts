import type { ThunkDispatch } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootLike } from './createPostSlice';

/** Typed hooks scoped to this feature, so you don't need to export your app's RootState. */
export const useCreatePostSelector: TypedUseSelectorHook<RootLike> = useSelector;
export const useCreatePostDispatch = () => useDispatch<ThunkDispatch<RootLike, undefined, any>>();
