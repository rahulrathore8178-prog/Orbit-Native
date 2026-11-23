import axios from 'axios';
import { useCallback, useState } from 'react';
import { getAuthHeaders } from '@/components/services/feed/postUtils';
import { API_URL } from '@/lib/utils';

// TODO: point at your real follow / add-friend endpoint.
const followUrl = (id: string) => `${API_URL}/api/social/follow/${id}`;

export function useFlareFollow() {
    const [following, setFollowing] = useState<Record<string, boolean>>({});

    const toggle = useCallback(async (authorId: string, current: boolean) => {
        const next = !current;
        setFollowing((m) => ({ ...m, [authorId]: next }));
        try {
            await axios({
                method: next ? 'post' : 'delete',
                url: followUrl(authorId),
                withCredentials: true,
                headers: await getAuthHeaders(),
            });
        } catch (e) {
            console.error('Follow error:', e);
            setFollowing((m) => ({ ...m, [authorId]: current }));
        }
    }, []);

    return { following, toggle };
}