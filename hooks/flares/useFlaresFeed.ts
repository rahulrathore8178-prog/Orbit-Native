import { FlarePost } from "@/constants/flares/types";
import { API_URL, getAuthHeaders } from "@/lib/utils";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { toPostcardProps } from '@/components/services/feed/postUtils';

const LIMIT = 8;
// TODO: use the same route your useHomeFeed calls
const FEED_URL = `${API_URL}/api/community/feed`;

async function fetchPage(page: number) {
    const res = await axios.get(FEED_URL, {
        params: {
            type: 'flares',
            page,
            limit: LIMIT,
        },
        withCredentials: true,
        headers: await getAuthHeaders(),
    });

    const items = (res.data?.posts ?? []).map(
        (post: any) => ({
            ...toPostcardProps(post),
            hashtags: post.hashtags,
        }) as FlarePost,
    );

    return {
        items,
        hasMore: Boolean(res.data?.pagination?.hasMore),
    };
}

export function useFlaresFeed() {
    const [posts, setPosts] = useState<FlarePost[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const page = useRef(0);
    const busy = useRef(false);

    const load = useCallback(async (reset: boolean) => {
        if (busy.current) return;
        busy.current = true;
        reset ? setRefreshing(true) : setLoadingMore(true);
        try {
            const next = reset ? 1 : page.current + 1;
            const { items, hasMore: more } = await fetchPage(next);
            page.current = next;
            setHasMore(more);
            setPosts((prev) => {
                if (reset) return items;
                const seen = new Set(prev.map((p) => p.id));
                return [...prev, ...items.filter((p) => !seen.has(p.id))];
            });
        } catch (e) {
            console.error('Flares feed error:', e);
        } finally {
            busy.current = false;
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => { load(true); }, [load]);

    return {
        posts, loading, refreshing, loadingMore, hasMore,
        refresh: () => load(true),
        loadMore: () => hasMore && load(false),
    };
}