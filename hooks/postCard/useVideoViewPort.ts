import { RefObject, useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';

/**
 * Decides which video plays, for ANY scroll container (FlatList, ScrollView, horizontal pager).
 * It measures the video box against the window ~6x a second instead of relying on a list's
 * viewability callback, so every screen that renders a post card behaves the same.
 *
 *  - starts when >= 70% of the video is on screen
 *  - keeps playing until less than 30% is on screen (no flicker around the edge)
 *  - only ONE video owns playback at a time (the one that got >= 70% first, or a clearly more visible one)
 */
const START = 0.7;
const STOP = 0.3;
const POLL_MS = 150;

let owner: string | null = null;
const fractions = new Map<string, number>();

function measure(ref: RefObject<View | null>, cb: (fraction: number, scale: number) => void) {
    const node = ref.current;
    if (!node) return cb(0, 1);
    node.measureInWindow((x, y, w, h) => {
        if (!w || !h) return cb(0, 1);
        const { width: sw, height: sh } = Dimensions.get('window');
        const ix = Math.max(0, Math.min(x + w, sw) - Math.max(x, 0));
        const iy = Math.max(0, Math.min(y + h, sh) - Math.max(y, 0));
        // a box taller than ~80% of the screen can never show 70% of itself, so scale the limits down
        const scale = Math.min(1, (sh * 0.8) / h);
        cb((ix * iy) / (w * h), scale);
    });
}

/** `active`: this video should be playing. `onScreen`: still at least partly in view (used to stop manual plays). */
export function useVideoViewport(ref: RefObject<View | null>, enabled: boolean) {
    const key = useRef(Math.random().toString(36).slice(2)).current; // unique per card instance
    const [state, setState] = useState({ active: false, onScreen: false });

    useEffect(() => {
        if (!enabled) {
            if (owner === key) owner = null;
            fractions.delete(key);
            setState({ active: false, onScreen: false });
            return;
        }
        let alive = true;

        const tick = () =>
            measure(ref, (f, scale) => {
                if (!alive) return;
                fractions.set(key, f);
                const start = START * scale;
                const stop = STOP * scale;

                if (owner === key) {
                    if (f < stop) owner = null;
                } else if (f >= start) {
                    const ownerFraction = owner ? fractions.get(owner) ?? 0 : 0;
                    if (owner === null || ownerFraction < start) owner = key;
                }

                const next = { active: owner === key, onScreen: f >= stop };
                setState((prev) => (prev.active === next.active && prev.onScreen === next.onScreen ? prev : next));
            });

        tick();
        const id = setInterval(tick, POLL_MS);
        return () => {
            alive = false;
            clearInterval(id);
            if (owner === key) owner = null;
            fractions.delete(key);
        };
    }, [enabled, key, ref]);

    return state;
}

/** Plain "is at least 30% of this on screen" check (voice notes: pause when scrolled away, no ownership). */
export function useOnScreen(ref: RefObject<View | null>, enabled: boolean) {
    const [on, setOn] = useState(true);
    useEffect(() => {
        if (!enabled) return setOn(false);
        let alive = true;
        const tick = () => measure(ref, (f) => alive && setOn(f >= STOP));
        tick();
        const id = setInterval(tick, POLL_MS * 2);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [enabled, ref]);
    return on;
}