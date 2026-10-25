import { authStorage } from '@/lib/auth/authStorage';
import { API_URL } from '@/lib/utils';
import axios from 'axios';

/**
 * Routes (mounted under the community posts router):
 *   GET  /saved
 *   POST /saved/collections
 *   POST /saved/collections/:collectionId/:postId
 *
 * Adjust BASE if the router is mounted somewhere else.
 */

export const api = axios.create({
    baseURL: `${API_URL}/api/community`,
    timeout: 15000,
    withCredentials: true,
});

api.interceptors.request.use(async (config) => {
    const token = await authStorage.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

/* ───────────── Types (raw backend shapes) ───────────── */
export interface RawSavedEntry {
    post: Record<string, any>;
    savedAt: string;
}

export interface SavedCollection {
    _id: string;
    name: string;
    posts?: string[];
    createdAt?: string;
    [key: string]: unknown;
}

export interface GetSavedPostsResponse {
    savedPosts: RawSavedEntry[];
    collections?: SavedCollection[]; // present only if your controller returns them
}

export interface CreateCollectionPayload {
    name: string; // ← match the field your controller reads
    [key: string]: unknown;
}

/* ───────────── Calls ───────────── */

/** GET /saved */
export const getSavedPosts = async (): Promise<GetSavedPostsResponse> => {
    try {
        const { data } = await api.get<GetSavedPostsResponse>('/saved');
        return data;
    } catch (error) {
        console.error('Error fetching saved posts:', error);
        throw error;
    }
};

/** POST /saved/collections */
export const createSavedCollection = async (
    payload: CreateCollectionPayload,
): Promise<SavedCollection> => {
    try {
        const { data } = await api.post(`/saved/collections`, payload);
        return data?.collection ?? data;
    } catch (error) {
        console.error('Error creating saved collection:', error);
        throw error;
    }
};

/** POST /saved/collections/:collectionId/:postId */
export const addPostToCollection = async (collectionId: string, postId: string) => {
    try {
    const { data } = await api.post(`/saved/collections/${collectionId}/${postId}`);
        return data;
    } catch (error) {
        console.error('Error adding post to collection:', error);
        throw error;
    }
};

/**
 * Not in the route list you sent. This is what the optimistic "remove from saved"
 * uses today. Point it at your real unsave route (or tell me the route and I'll wire it).
 */
export const removeSavedPost = async (postId: string) => {
    try {
        const { data } = await api.delete(`/saved/${postId}`);
        return data;
    } catch (error) {
        console.error('Error removing saved post:', error);
        throw error;
    }
};
