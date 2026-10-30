import type { ShareTarget } from '@/components/posts/ShareModal';
import {
    getAuthHeaders,
    stripHost,
    toList,
    toPostcardProps,
    toShareTarget,
    type PostcardProps,
    type StoredUser,
} from '@/components/services/feed/postUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../lib/utils';

/** Returns true if the server counted it (false = already viewed by this user). */
export async function registerView(postId: string): Promise<boolean> {
    console.log('registerView', postId);
    const { data } = await axios.post(`${API_URL}/api/community/posts/${postId}/view`, null, {
        withCredentials: true,
        headers: await getAuthHeaders(),
        timeout: 10000,
    });
    return !!data?.counted;
}

/** Logged-in user, read once from storage. */
export function useCurrentUser() {
    const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('user');
                if (!raw) return setCurrentUser(null);
                const user = JSON.parse(raw);
                setCurrentUser({ ...user, profilePic: stripHost(user?.profilePic) });
            } catch (error) {
                console.error('Error loading current user:', error);
                setCurrentUser(null);
            }
        })();
    }, []);

    return currentUser;
}

/** "Your feed" posts: initial load, pull-to-refresh, comment count patching. */
const PAGE_SIZE = 10;

export function useHomeFeed() {
    const [posts, setPosts] = useState<PostcardProps[]>([]);
    const [loading, setLoading] = useState(true); // first load only
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const pageRef = useRef(1); // last page we have
    const busy = useRef(false); // one request at a time
    const hasMoreRef = useRef(true);
    const epoch = useRef(0); // bumped on refresh so stale responses are ignored

    const fetchPage = useCallback(async (page: number) => {
        const { data } = await axios.get(`${API_URL}/api/community/feed`, {
            params: { page, limit: PAGE_SIZE, type: 'feed' },
            withCredentials: true,
            headers: await getAuthHeaders(),
        });
        const list = Array.isArray(data) ? data : data?.posts;
        const items: PostcardProps[] = Array.isArray(list) ? list.map(toPostcardProps) : [];
        const more = Array.isArray(data) ? false : (data?.pagination?.hasMore ?? items.length >= PAGE_SIZE);
        return { items, more };
    }, []);

    /** Page 1: first load and pull-to-refresh. Replaces the list. */
    const reload = useCallback(async () => {
        const myEpoch = ++epoch.current;
        busy.current = true;
        setLoadingMore(false);
        try {
            const { items, more } = await fetchPage(1);
            if (myEpoch !== epoch.current) return;
            const seen = new Set<string>();
            setPosts(items.filter((p) => !seen.has(p.id) && !!seen.add(p.id)));
            pageRef.current = 1;
            hasMoreRef.current = more;
            setHasMore(more);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log('feed failed', { code: error.code, status: error.response?.status });
            }
            // keep whatever is already on screen if a refresh fails
        } finally {
            if (myEpoch === epoch.current) {
                busy.current = false;
                setLoading(false);
            }
        }
    }, [fetchPage]);

    /** Next page. Appends only posts we don't already have. */
    const loadMore = useCallback(async () => {
        if (busy.current || !hasMoreRef.current) return;
        busy.current = true;
        setLoadingMore(true);
        const myEpoch = epoch.current;
        try {
            // if a whole page turns out to be duplicates, skip ahead (max 3 tries)
            for (let tries = 0; tries < 3; tries++) {
                const nextPage = pageRef.current + 1;
                const { items, more } = await fetchPage(nextPage);
                if (myEpoch !== epoch.current) return;

                pageRef.current = nextPage;
                hasMoreRef.current = more;
                setHasMore(more);

                let added = 0;
                setPosts((prev) => {
                    const seen = new Set(prev.map((p) => p.id));
                    const fresh = items.filter((p) => !seen.has(p.id));
                    added = fresh.length;
                    return fresh.length ? [...prev, ...fresh] : prev;
                });
                if (added > 0 || !more) break;
            }
        } catch {
            // network blip: hasMore stays true, so the next scroll to the end retries
        } finally {
            if (myEpoch === epoch.current) {
                busy.current = false;
                setLoadingMore(false);
            }
        }
    }, [fetchPage]);

    useEffect(() => {
        reload();
    }, [reload]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    }, [reload]);

    const bumpComments = useCallback((postId: string, delta: number) => {
        setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount + delta) } : p)),
        );
    }, []);

    return { posts, loading, refreshing, loadingMore, hasMore, refresh, loadMore, bumpComments };
}

/** Share sheet state + lazily loaded friends / orbitals (fetched once, then cached). */
export function useShare() {
    const [shareId, setShareId] = useState<string | null>(null);
    const [friends, setFriends] = useState<ShareTarget[]>([]);
    const [orbitals, setOrbitals] = useState<ShareTarget[]>([]);
    const loaded = useRef(false);

    const loadTargets = useCallback(async () => {
        if (loaded.current) return;
        const headers = await getAuthHeaders();
        const [f, o] = await Promise.allSettled([
            axios.get(`${API_URL}/api/social/friends`, { headers }),
            axios.get(`${API_URL}/api/orbital/all`, { headers }),
        ]);
        if (f.status === 'fulfilled') setFriends(toList(f.value.data, 'friends').map(toShareTarget));
        if (o.status === 'fulfilled') setOrbitals(toList(o.value.data, 'orbitals').map(toShareTarget));
        if (f.status === 'fulfilled' || o.status === 'fulfilled') loaded.current = true;
    }, []);

    const open = useCallback(
        (id: string) => {
            setShareId(id);
            loadTargets();
        },
        [loadTargets],
    );
    const close = useCallback(() => setShareId(null), []);

    return { shareId, friends, orbitals, open, close };
}

/** Tracks which list item is on screen so only that post autoplays. One per list. */
export function useVisibleId() {
    const [visibleId, setVisibleId] = useState<string | null>(null);
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        const first = viewableItems.find((v: any) => v.isViewable);
        setVisibleId(first?.item?.id ?? null);
    }).current;
    return { visibleId, onViewableItemsChanged };
}

export const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 70, minimumViewTime: 100 };