import { useCallback } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Use this anywhere a username or avatar is tappable (posts, comments, friends, search).
 * Your own id goes to the profile tab; anyone else opens as a pushed page.
 */
export function useOpenProfile() {
    return useCallback(async (userId: string) => {
        const raw = await AsyncStorage.getItem('user');
        const me = raw ? JSON.parse(raw) : null;
        const myId = me?.id ?? me?._id;

        if (myId && myId === userId) router.navigate('/(tabs)/profile');
        else router.push({ pathname: '/user/[id]', params: { id: userId } });
    }, []);
}