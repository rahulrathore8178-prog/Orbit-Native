import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorage } from './authStorage';
import { POOL } from '@/components/services/serverPool';
import { Platform } from 'expo';

// Login/register return 401 for wrong credentials, which must NOT trigger a logout.
const AUTH_PATHS = ['/api/auth/user/login', '/api/auth/user/register'];

type Tagged = InternalAxiosRequestConfig & { __accountId?: string | null };

let onUnauthorized: ((accountId: string | null) => void) | null = null;
export const setUnauthorizedHandler = (fn: ((accountId: string | null) => void) | null) => {
    onUnauthorized = fn;
};

// Only attach the token to YOUR API, never to third parties (Giphy etc.).
const isOurApi = (url: string) => POOL.some((server) => url.startsWith(server.url));

// A request sent by account A that comes back after switching to B must not touch B's state.
const isStale = (cfg?: Tagged) => {
    const tag = cfg?.__accountId;
    return !!tag && tag !== authStorage.getActiveIdSync();
};

let installed = false;

/** Call once at app start. Patches the default axios instance, so every existing axios.get/post call is covered. */
export function setupAxios() {
    if (installed) return;
    installed = true;

    axios.interceptors.request.use(async (config) => {
        const raw = config.url ?? '';
        const url = /^https?:\/\//.test(raw) ? raw : (config.baseURL ?? '') + raw;
        if (!isOurApi(url)) return config;

        await authStorage.ready();

        // The phone's cookie jar must never decide which account a request belongs to.
        // This also stops the native layer from storing the login Set-Cookie.
        if (Platform.OS !== 'web') config.withCredentials = false;

        const explicit = config.headers.get('Authorization');
        const explicitToken = explicit ? String(explicit).replace(/^Bearer\s+/i, '') : null;

        // A token that does not belong to any saved account (e.g. the pending Google token used by
        // complete-profile) must be sent exactly as the caller set it.
        if (explicitToken && !authStorage.ownerOfToken(explicitToken)) return config;

        // Everything else always uses the account that is active at send time.
        const { accountId, token } = authStorage.getSessionSync();
        if (token) {
            config.headers.set('Authorization', `Bearer ${token}`);
            (config as Tagged).__accountId = accountId;
        } else {
            config.headers.delete('Authorization');
            (config as Tagged).__accountId = null;
        }
        return config;
    });
    
    axios.interceptors.response.use(
        (res) => (isStale(res.config as Tagged) ? Promise.reject(new axios.CanceledError('account-switched')) : res),
        (error: AxiosError) => {
            if (axios.isCancel(error)) return Promise.reject(error);
            const cfg = error.config as Tagged | undefined;
            const url = cfg?.url ?? '';
            const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));

            // Only requests that carried a saved account's token can expire that account.
            if (error.response?.status === 401 && !isAuthCall && cfg?.__accountId) {
                onUnauthorized?.(cfg.__accountId);
            }
            if (isStale(cfg)) return Promise.reject(new axios.CanceledError('account-switched'));
            return Promise.reject(error);
        }
    );
}