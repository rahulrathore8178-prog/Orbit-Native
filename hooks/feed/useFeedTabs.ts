import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { cancelAnimation, useSharedValue, withSpring } from 'react-native-reanimated';
import { useHorizontalSwipe } from './useHorizontalSwipe';

export type FeedTab = 0 | 1;
export const FEED_TABS = ['Your feed', 'Orbitals'] as const;

// Critically damped + clamped: settles fast, never bounces past the page.
const SPRING = { damping: 28, stiffness: 240, mass: 0.8, overshootClamping: true };
const EDGE_RESISTANCE = 0.25; // how much the pager follows the finger past the first/last page
const FLICK_MS = 220; // how far ahead (in ms of finger speed) we project the release point

/** Follows the finger 1:1 inside [0, 1], with resistance outside it. */
const rubberBand = (x: number) => (x < 0 ? x * EDGE_RESISTANCE : x > 1 ? 1 + (x - 1) * EDGE_RESISTANCE : x);
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/**
 * State for the two home tabs.
 *  - `position` (shared value): 0 = Your feed, 1 = Orbitals, fractional while the finger is down.
 *    Everything visual (pager, pill, labels, tray fade) is derived from it on the UI thread.
 *  - `tab`: the committed tab as React state, for things that aren't animated (a11y, pointerEvents).
 */
export function useFeedTabs() {
    const { width } = useWindowDimensions();
    const [tab, setTab] = useState<FeedTab>(0);
    const position = useSharedValue(0);
    const gestureStart = useSharedValue(0);

    const goTo = useCallback(
        (to: FeedTab, velocity = 0) => {
            setTab(to);
            position.set(withSpring(to, { ...SPRING, velocity }));
        },
        [position]
    );

    const swipe = useHorizontalSwipe({
        blockTermination: true,
        // Finger down: stop any running animation so you can catch the pager mid-flight.
        onStart: () => {
            cancelAnimation(position);
            gestureStart.set(position.get());
        },
        onDrag: (dx) => position.set(rubberBand(gestureStart.get() - dx / width)),
        onRelease: ({ vx }) => {
            const projected = position.get() - (vx * FLICK_MS) / width;
            const to: FeedTab = projected > 0.5 ? 1 : 0;
            // hand the finger's speed to the spring so the motion continues, not restarts
            goTo(to, clamp((-vx * 1000) / width, -8, 8));
        },
    });

    return { tab, position, goTo, panHandlers: swipe.panHandlers };
}
