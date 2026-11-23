import { useEffect, useState } from 'react';
import type { CapsuleUser } from '../../constants/capsule/types';
import { authStorage } from '@/lib/auth/authStorage';

export function useCurrentUser() {
  const [user, setUser] = useState<CapsuleUser | null>(null);
  useEffect(() => {
    authStorage.getUser()
      .then((u) => {
        if (!u) return setUser(null);
        setUser({
          id: String(u.id ?? u._id),
          username: u.username ?? u.name ?? '',
          avatar: u.avatar ?? u.profilePic,
        });
      })
      .catch((error) => {
        console.error('Error loading current user:', error);
        setUser(null);
      });
  }, []);
  return user;
}
