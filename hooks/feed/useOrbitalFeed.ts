import { fetchOrbitalFeed, getFeedErrorMessage } from '@/components/services/feed/orbitalFeedService';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'initial' | 'refresh' | 'more';
type Identified = { id: string };

const mergeById = <T extends Identified>(current: T[], incoming: T[]) => {
    const seen = new Set(current.map((p) => p.id));
    return [...current, ...incoming.filter((p) => !seen.has(p.id))];
};

/**
 * Data for the Orbitals tab: first load, pull-to-refresh, infinite scroll (cursor based),
 * error + retry. Stale requests are aborted, so a refresh can never be overwritten by an
 * older page arriving late.
 *
 * @param mapPost turns a raw api post into your list item, pass your `toPostcardProps`
 */
export function useOrbitalFeed<T extends Identified>(mapPost: (raw: any) => T) {
    const [map] = useState(() => mapPost); // snapshot: keeps `load` stable across renders
    const [posts, setPosts] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cursor = useRef<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const fetchingMore = useRef(false);

    const load = useCallback(
        async (mode: Mode) => {
            if (mode === 'more' && (fetchingMore.current || !cursor.current)) return;

            controller.current?.abort();
            const request = new AbortController();
            controller.current = request;
            fetchingMore.current = mode === 'more';

            if (mode === 'initial') setLoading(true);
            if (mode === 'refresh') setRefreshing(true);
            if (mode === 'more') setLoadingMore(true);
            setError(null);

            try {
                const page = await fetchOrbitalFeed(mode === 'more' ? cursor.current : null, request.signal);
                console.log('ORBITAL API RESPONSE', page);
                const mapped = page.posts.map(map);
                cursor.current = page.nextCursor;
                setHasMore(page.nextCursor !== null);
                setPosts((prev) => (mode === 'more' ? mergeById(prev, mapped) : mapped));
            } catch (err) {
                if (axios.isCancel(err)) return;
                if (__DEV__ && axios.isAxiosError(err)) {
                    console.log('orbital feed failed', {
                        url: err.config?.url,
                        status: err.response?.status,
                        message: err.message,
                    });
                }
                setError(getFeedErrorMessage(err));
            } finally {
                if (!request.signal.aborted) {
                    fetchingMore.current = false;
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [map]
    );

    useEffect(() => {
        load('initial');
        return () => controller.current?.abort();
    }, [load]);

    const refresh = useCallback(() => load('refresh'), [load]);
    const loadMore = useCallback(() => load('more'), [load]);
    const retry = useCallback(() => load('initial'), [load]);

    // For optimistic updates (comment count etc.) done from outside a post card.
    const patchPost = useCallback((id: string, changes: Partial<T>) => {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    }, []);
    const removePost = useCallback((id: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return { posts, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore, retry, patchPost, removePost };
}

export type OrbitalFeed<T extends Identified> = ReturnType<typeof useOrbitalFeed<T>>;
