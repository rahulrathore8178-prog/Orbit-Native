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
export function useHomeFeed() {
    const [posts, setPosts] = useState<PostcardProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API_URL}/api/community/feed`, {
                withCredentials: true,
                headers: await getAuthHeaders(),
            });
            const list = Array.isArray(data) ? data : data?.posts;
            setPosts(Array.isArray(list) ? list.map(toPostcardProps) : []);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log('feed failed', {
                    url: error.config?.url,
                    code: error.code,
                    message: error.message,
                    status: error.response?.status,
                });
            }
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const bumpComments = useCallback((postId: string, delta: number) => {
        setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount + delta) } : p)),
        );
    }, []);

    return { posts, loading, refreshing, refresh, bumpComments };
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