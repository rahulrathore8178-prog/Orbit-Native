import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import type { CurrentUser } from '../../constants/createPost/types';

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);

/** Accepts the different key names a user object might use for its photo. */
const pickPhoto = (u?: CurrentUser | null) =>
  str(u?.profilePic) ?? str(u?.avatar) ?? str(u?.profilePicture) ?? str(u?.image) ?? str(u?.photo);

/**
 * Resolves who is posting. Uses the `user` prop first; if that is missing or has no photo
 * (the usual reason the profile picture didn't show), falls back to the user saved in AsyncStorage.
 */
export function useCurrentUser(userProp?: CurrentUser): { username?: string; profilePic?: string } {
  const [stored, setStored] = useState<{ username?: string; profilePic?: string }>({});
  const propPhoto = pickPhoto(userProp);
  const propName = str(userProp?.username);

  useEffect(() => {
    if (propPhoto && propName) return;
    let alive = true;
    AsyncStorage.getItem('user')
      .then((raw) => {
        if (!alive || !raw) return;
        const u = JSON.parse(raw) as CurrentUser;
        setStored({ username: str(u.username), profilePic: pickPhoto(u) });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [propPhoto, propName]);

  return useMemo(
    () => ({ username: propName ?? stored.username, profilePic: propPhoto ?? stored.profilePic }),
    [propName, propPhoto, stored],
  );
}
