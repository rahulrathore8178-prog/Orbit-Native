import { getAuthHeaders } from '@/components/services/feed/postUtils';
import { getFeedErrorMessage } from '@/components/services/feed/orbitalFeedService';
import { API_URL } from '@/lib/utils';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'initial' | 'refresh' | 'more';
type Identified = { id: string };

const PAGE_SIZE = 10;

async function fetchOrbitalPage(page: number, signal: AbortSignal) {
    const { data } = await axios.get(`${API_URL}/api/community/feed`, {
        params: { page, limit: PAGE_SIZE, type: 'orbital' },
        withCredentials: true,
        headers: await getAuthHeaders(),
        signal,
    });
    const list = Array.isArray(data) ? data : data?.posts;
    const posts: any[] = Array.isArray(list) ? list : [];
    const more = Array.isArray(data) ? false : (data?.pagination?.hasMore ?? posts.length >= PAGE_SIZE);
    return { posts, more };
}

export function useOrbitalFeed<T extends Identified>(mapPost: (raw: any) => T) {
    const [map] = useState(() => mapPost); // snapshot keeps `load` stable
    const [posts, setPosts] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pageRef = useRef(1);
    const hasMoreRef = useRef(false);
    const seen = useRef(new Set<string>()); // every id already on screen
    const busy = useRef(false); // any request in flight
    const controller = useRef<AbortController | null>(null);

    const load = useCallback(
        async (mode: Mode) => {
            // never let "load more" interrupt a refresh or another page
            if (mode === 'more' && (busy.current || !hasMoreRef.current)) return;

            controller.current?.abort(); // initial/refresh cancel anything stale
            const request = new AbortController();
            controller.current = request;
            busy.current = true;

            if (mode === 'initial') setLoading(true);
            if (mode === 'refresh') setRefreshing(true);
            if (mode === 'more') setLoadingMore(true);
            if (mode !== 'more') setError(null);

            try {
                if (mode === 'more') {
                    // if a whole page is duplicates (new posts shifted the offsets), skip ahead (max 3)
                    let fresh: T[] = [];
                    let more = true;
                    let page = pageRef.current;
                    for (let i = 0; i < 3 && fresh.length === 0 && more; i++) {
                        page += 1;
                        const r = await fetchOrbitalPage(page, request.signal);
                        more = r.more;
                        fresh = r.posts.map(map).filter((p) => !seen.current.has(p.id));
                    }
                    fresh.forEach((p) => seen.current.add(p.id));
                    pageRef.current = page;
                    hasMoreRef.current = more;
                    setHasMore(more);
                    if (fresh.length) setPosts((prev) => [...prev, ...fresh]);
                } else {
                    const r = await fetchOrbitalPage(1, request.signal);
                    const ids = new Set<string>();
                    const mapped = r.posts.map(map).filter((p) => !ids.has(p.id) && !!ids.add(p.id));
                    seen.current = ids;
                    pageRef.current = 1;
                    hasMoreRef.current = r.more;
                    setHasMore(r.more);
                    setPosts(mapped);
                }
            } catch (err) {
                if (axios.isCancel(err)) return;
                if (__DEV__ && axios.isAxiosError(err)) {
                    console.log('orbital feed failed', { status: err.response?.status, message: err.message });
                }
                // a failed "load more" shouldn't replace the list with an error; the next scroll retries
                if (mode !== 'more') setError(getFeedErrorMessage(err));
            } finally {
                if (!request.signal.aborted) {
                    busy.current = false;
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [map],
    );

    useEffect(() => {
        load('initial');
        return () => controller.current?.abort();
    }, [load]);

    const refresh = useCallback(() => load('refresh'), [load]);
    const loadMore = useCallback(() => load('more'), [load]);
    const retry = useCallback(() => load('initial'), [load]);

    const patchPost = useCallback((id: string, changes: Partial<T>) => {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    }, []);
    const removePost = useCallback((id: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return { posts, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore, retry, patchPost, removePost };
}

export type OrbitalFeed<T extends Identified> = ReturnType<typeof useOrbitalFeed<T>>;