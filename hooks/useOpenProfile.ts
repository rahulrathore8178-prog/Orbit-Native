import { useCallback } from 'react';
import { router } from 'expo-router';
import { authStorage } from '@/lib/auth/authStorage';

/**
 * Use this anywhere a username or avatar is tappable (posts, comments, friends, search).
 * Your own id goes to the profile tab; anyone else opens as a pushed page.
 */
export function useOpenProfile() {
    return useCallback(async (userId: string) => {
        const me = await authStorage.getUser();
        const myId = me?.id ?? me?._id;

        if (myId && myId === userId) router.navigate('/(tabs)/profile');
        else router.push({ pathname: '/user/[id]', params: { id: userId } });
    }, []);
}