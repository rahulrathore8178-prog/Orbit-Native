import { registerView } from './useHomeFeed';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';

const DWELL_MS = 1000; // continuous full visibility needed
const TICK_MS = 250; // how often visibility is re-measured
const TOL = 2; // px tolerance for sub-pixel rounding

/** Coarse gate for the FlatList: a post is a candidate once it is entirely in the list,
 *  or covers 50% of it (tall posts). The exact check is done by measureInWindow below. */
export const VIEW_COUNT_CONFIG = { viewAreaCoveragePercentThreshold: 50, minimumViewTime: 0 };

type Options = {
    enabled: boolean; // false while a modal/sheet/drawer is open or the screen isn't focused
    safeTop: number; // y where the glass header ends
    safeBottom: number; // height of the floating tab bar area at the bottom
    isViewed?: (postId: string) => boolean; // optional: skip posts this user already viewed
};

export function usePostViews({ enabled, safeTop, safeBottom, isViewed }: Options) {
    const { width, height } = useWindowDimensions();

    const nodes = useRef(new Map<string, View>());
    const timers = useRef(new Map<string, { timer: ReturnType<typeof setInterval>; ms: number }>());
    const done = useRef(new Set<string>()); // counted or in flight this session

    const opts = useRef({ enabled, top: safeTop, bottom: height - safeBottom, width, isViewed });
    useEffect(() => {
        opts.current = { enabled, top: safeTop, bottom: height - safeBottom, width, isViewed };
    }, [enabled, safeTop, safeBottom, height, width, isViewed]);

    const stop = useCallback((id: string) => {
        const t = timers.current.get(id);
        if (t) clearInterval(t.timer);
        timers.current.delete(id);
    }, []);

    const commit = useCallback((id: string) => {
        if (done.current.has(id)) return;
        done.current.add(id);
        registerView(id).catch(() => done.current.delete(id)); // fire and forget; retry later if it failed
    }, []);

    const tick = useCallback(
        (id: string) => {
            const entry = timers.current.get(id);
            const node = nodes.current.get(id);
            const o = opts.current;
            if (!entry || !node || !o.enabled || AppState.currentState !== 'active') {
                if (entry) entry.ms = 0;
                return;
            }
            node.measureInWindow((x, y, w, h) => {
                const t = timers.current.get(id);
                if (!t) return;
                const onThisPage = x >= -TOL && x + w <= o.width + TOL; // not on the off-screen tab
                const fullyVisible = y >= o.top - TOL && y + h <= o.bottom + TOL;
                const fillsScreen = h > o.bottom - o.top && y <= o.top + TOL && y + h >= o.bottom - TOL;

                if (onThisPage && (fullyVisible || fillsScreen)) {
                    t.ms += TICK_MS;
                    if (t.ms >= DWELL_MS) {
                        stop(id);
                        commit(id);
                    }
                } else {
                    t.ms = 0; // interrupted: start over
                }
            });
        },
        [commit, stop],
    );

    const start = useCallback(
        (id: string) => {
            if (done.current.has(id) || timers.current.has(id)) return;
            if (opts.current.isViewed?.(id)) return;
            const entry = { ms: 0, timer: setInterval(() => tick(id), TICK_MS) };
            timers.current.set(id, entry);
        },
        [tick],
    );

    // pass to a FlatList viewabilityConfigCallbackPairs entry
    const onViewableItemsChanged = useRef(({ changed }: { changed: any[] }) => {
        for (const c of changed) {
            const id: string | undefined = c.item?.id;
            if (!id) continue;
            if (c.isViewable) start(id);
            else stop(id);
        }
    }).current;

    // attach to each post's wrapper View (collapsable={false} so Android can measure it)
    const setNode = useCallback((id: string, node: View | null) => {
        if (node) nodes.current.set(id, node);
        else nodes.current.delete(id);
    }, []);

    useEffect(() => {
        const running = timers.current;
        return () => running.forEach((t) => clearInterval(t.timer));
    }, []);

    return { onViewableItemsChanged, setNode };
}