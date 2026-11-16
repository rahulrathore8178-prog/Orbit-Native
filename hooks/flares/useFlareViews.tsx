import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { registerView } from '@/hooks/feed/useHomeFeed';
import { viewedIds } from '../feed/viewedStore';

const DWELL_MS = 1000;

/** Counts a view once the flare has been the active page for 1s, while the app is in the foreground. */
export function useFlareViews(postId: string | undefined, enabled: boolean) {
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (!enabled || !appActive || !postId || viewedIds.has(postId)) return;
        const t = setTimeout(() => {
            if (viewedIds.has(postId)) return;
            viewedIds.add(postId);
            registerView(postId).catch(() => viewedIds.delete(postId)); // retry on the next visit if it failed
        }, DWELL_MS);
        return () => clearTimeout(t);
    }, [postId, enabled, appActive]);
}