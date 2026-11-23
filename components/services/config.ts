import { getActiveUrl, subscribe, POOL } from "./serverPool";

const stripSlash = (v?: string) => (v ?? '').trim().replace(/\/+$/, '');

export const PYTHON_API_URL = stripSlash(process.env.EXPO_PUBLIC_PYTHON_API_URL);
export const BASE_IMAGE_URL = stripSlash(process.env.EXPO_PUBLIC_BASE_URL);

// Live bindings: they update automatically when the active server changes.
export let API_URL = getActiveUrl();
export let API_BASE = API_URL;
subscribe((s) => { API_URL = s.url; API_BASE = s.url; });

if (!API_URL) {
    console.error('EXPO_PUBLIC_API_URL is missing in this build. Set it with `eas env:create`.');
}

// Swap the host of any pool-server URL (stored media URLs) to the active server.
export const rebase = (u?: string) => {
    if (!u) return u;
    const base = getActiveUrl();
    for (const s of POOL) {
        if (s.url !== base && u.startsWith(s.url)) return base + u.slice(s.url.length);
    }
    return u;
};

// ---- keep getDisplayImageUrl, getAuthHeaders, stripHost exactly as they are ----

export const resolveImg = (p?: string) =>
    !p ? p : /^https?:\/\//.test(p) ? rebase(p) : `${getActiveUrl()}${p}`;