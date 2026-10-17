import axios, { AxiosError } from 'axios';
import { authStorage } from './authStorage';
import { API_URL } from '../utils';

// Login/register return 401 for wrong credentials, which must NOT trigger a logout.
const AUTH_PATHS = ['/api/auth/user/login', '/api/auth/user/register'];

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
    onUnauthorized = fn;
};

// Only attach the token to YOUR API, never to third parties (Giphy etc.).
const isOurApi = (url: string) => !!API_URL && url.startsWith(API_URL);

let installed = false;

/** Call once at app start. Patches the default axios instance, so every existing axios.get/post call is covered. */
export function setupAxios() {
    if (installed) return;
    installed = true;

    axios.interceptors.request.use(async (config) => {
        const raw = config.url ?? '';
        const url = /^https?:\/\//.test(raw) ? raw : (config.baseURL ?? '') + raw;

        if (isOurApi(url)) {
            const token = await authStorage.getToken();
            if (token) config.headers.set('Authorization', `Bearer ${token}`);
        }
        return config;
    });

    axios.interceptors.response.use(
        (res) => res,
        (error: AxiosError) => {
            const url = error.config?.url ?? '';
            const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));
            if (error.response?.status === 401 && !isAuthCall) onUnauthorized?.();
            return Promise.reject(error);
        }
    );
}