import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// SecureStore doesn't exist on web, so web falls back to AsyncStorage (localStorage).
const useSecureStore = Platform.OS !== 'web';

export const authStorage = {
    // The token is the secret, so it goes in encrypted storage on native.
    getToken: (): Promise<string | null> =>
        useSecureStore ? SecureStore.getItemAsync(TOKEN_KEY) : AsyncStorage.getItem(TOKEN_KEY),

    setToken: (token: string): Promise<void> =>
        useSecureStore ? SecureStore.setItemAsync(TOKEN_KEY, token) : AsyncStorage.setItem(TOKEN_KEY, token),

    // The user object is not secret (and SecureStore has a ~2KB limit), so AsyncStorage is fine.
    async getUser<T = any>(): Promise<T | null> {
        const raw = await AsyncStorage.getItem(USER_KEY);
        try {
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    },

    setUser: (user: unknown): Promise<void> => AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),

    async clear(): Promise<void> {
        await Promise.all([
            useSecureStore ? SecureStore.deleteItemAsync(TOKEN_KEY) : AsyncStorage.removeItem(TOKEN_KEY),
            AsyncStorage.removeItem(USER_KEY),
        ]);
    },
};