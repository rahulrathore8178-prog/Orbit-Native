import { API_URL, getAuthHeaders } from '@/lib/utils';
import axios from 'axios';

const PAGE_SIZE = 10;

export type OrbitalFeedPage = { posts: unknown[]; nextCursor: string | null };

/**
 * Posts from every orbital the signed-in user is a member of, newest first.
 * Returns the RAW api posts, the hook maps them with your toPostcardProps.
 * ⚠️ ASSUMED route: GET /api/orbitals/feed  (controller in backend/orbitalFeed.controller.js)
 */
export async function fetchOrbitalFeed(cursor: string | null, signal: AbortSignal): Promise<OrbitalFeedPage> {
    const { data } = await axios.get(`${API_URL}/api/orbitals/all`, {
        params: { cursor: cursor ?? undefined, limit: PAGE_SIZE },
        headers: getAuthHeaders(),
        withCredentials: true,
        signal,
    });
    return { posts: data.posts ?? [], nextCursor: data.nextCursor ?? null };
}

export const getFeedErrorMessage = (err: unknown): string => {
    if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) return 'The orbitals feed endpoint was not found (GET /api/orbital/all).';
        if (err.response?.data?.message) return err.response.data.message;
    }
    return 'Could not load orbital posts';
};

