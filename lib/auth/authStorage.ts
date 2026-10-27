import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const useSecureStore = Platform.OS !== 'web';

// In-memory copy so sync callers (getAuthHeaders) never see a Promise.
let cachedToken: string | null = null;

export const authStorage = {
    getTokenSync: (): string | null => cachedToken,

    async getToken(): Promise<string | null> {
        const t = useSecureStore
            ? await SecureStore.getItemAsync(TOKEN_KEY)
            : await AsyncStorage.getItem(TOKEN_KEY);
        cachedToken = t;
        return t;
    },

    async setToken(token: string): Promise<void> {
        cachedToken = token;
        if (useSecureStore) await SecureStore.setItemAsync(TOKEN_KEY, token);
        else await AsyncStorage.setItem(TOKEN_KEY, token);
    },

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
        cachedToken = null;
        await Promise.all([
            useSecureStore ? SecureStore.deleteItemAsync(TOKEN_KEY) : AsyncStorage.removeItem(TOKEN_KEY),
            AsyncStorage.removeItem(USER_KEY),
        ]);
    },
};