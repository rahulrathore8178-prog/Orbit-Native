import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { getAuthHeaders } from '@/components/services/feed/postUtils';
import { API_URL } from '@/lib/utils';

type Override = { liked?: boolean; likeCount?: number; saved?: boolean; commentDelta?: number };

const store = new Map<string, Override>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};
const patch = (id: string, p: Override) => {
    store.set(id, { ...store.get(id), ...p });
    listeners.forEach((l) => l());
};

/** Flares tab only: bump a comment count after the comments sheet adds/removes one. */
export const bumpComments = (id: string, delta = 1) =>
    patch(id, { commentDelta: (store.get(id)?.commentDelta ?? 0) + delta });

type Base = {
    id: string;
    isLikedByCurrentUser: boolean;
    likesCount: number;
    isSaved?: boolean;
    commentsCount: number;
};

export function usePostActions(post: Base) {
    const { id } = post;
    const o = useSyncExternalStore(subscribe, () => store.get(id));

    const liked = o?.liked ?? post.isLikedByCurrentUser;
    const likeCount = o?.likeCount ?? post.likesCount;
    const saved = o?.saved ?? Boolean(post.isSaved);
    const commentsCount = post.commentsCount + (o?.commentDelta ?? 0);

    const likeBusy = useRef(false);
    const saveBusy = useRef(false);

    const like = useCallback(
        async (forceLike = false) => {
            if (likeBusy.current) return;
            if (forceLike && liked) return; // double tap never unlikes
            likeBusy.current = true;
            const next = !liked;
            patch(id, { liked: next, likeCount: likeCount + (next ? 1 : -1) });
            try {
                await axios.post(`${API_URL}/api/community/posts/${id}/like`, {}, {
                    withCredentials: true,
                    headers: await getAuthHeaders(),
                });
            } catch (e) {
                console.error('Like error:', e);
                patch(id, { liked: !next, likeCount });
            } finally {
                likeBusy.current = false;
            }
        },
        [id, liked, likeCount],
    );

    const toggleSave = useCallback(async () => {
        if (saveBusy.current) return;
        saveBusy.current = true;
        const next = !saved;
        patch(id, { saved: next });
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => { });
        try {
            await axios({
                method: next ? 'post' : 'delete',
                url: `${API_URL}/api/community/saved/${id}`,
                withCredentials: true,
                headers: await getAuthHeaders(),
            });
        } catch (e) {
            console.error('Save error:', e);
            patch(id, { saved: !next });
        } finally {
            saveBusy.current = false;
        }
    }, [id, saved]);

    return { liked, likeCount, saved, commentsCount, like, toggleSave };
}