import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CapsuleUser } from '../../constants/capsule/types';

// Reads the logged-in user from AsyncStorage key "user" (id or _id).
export function useCurrentUser() {
  const [user, setUser] = useState<CapsuleUser | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => {
        if (!raw) return;
        const u = JSON.parse(raw);
        setUser({
          id: String(u.id ?? u._id),
          username: u.username ?? u.name ?? '',
          avatar: u.avatar ?? u.profilePic,
        });
      })
      .catch(() => {});
  }, []);
  return user;
}
