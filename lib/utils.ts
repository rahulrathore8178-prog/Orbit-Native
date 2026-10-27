import { authStorage } from "./auth/authStorage";

const stripSlash = (v?: string) => (v ?? '').trim().replace(/\/+$/, '');

export const API_URL = stripSlash(process.env.EXPO_PUBLIC_API_URL);
export const PYTHON_API_URL = stripSlash(process.env.EXPO_PUBLIC_PYTHON_API_URL);
export const BASE_IMAGE_URL = stripSlash(process.env.EXPO_PUBLIC_BASE_URL);

if (!API_URL) {
    console.error('EXPO_PUBLIC_API_URL is missing in this build. Set it with `eas env:create`.');
}

// url for getting the display image from google drive
export function getDisplayImageUrl(
    imageUrl: string | null | undefined
): string {
    if (!imageUrl) return '';

    // Already converted
    if (imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
        return imageUrl;
    }

    // Google Drive uc?id=...
    const ucMatch = imageUrl.match(/[?&]id=([^&]+)/);
    if (ucMatch) {
        return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
    }

    // "/d/FILE_ID"
    const dMatch = imageUrl.match(/\/d\/([^/?]+)/);
    if (dMatch) {
        return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
    }

    return imageUrl;
}

// Authentication headers
export const getAuthHeaders = () => {
    const token = authStorage.getTokenSync();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const stripHost = (p?: string) => (p ? p.replace(/^https?:\/\/[^/]+/, '') : p);

// No localhost fallback: a silent fallback hides a misconfigured build.
export const API_BASE = API_URL.replace(/^ws/, 'http');

export const resolveImg = (p?: string) =>
    !p ? p : /^https?:\/\//.test(p) ? p : `${API_BASE}${p}`;