import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

type Options = {
    onSwipeRight?: () => void; // finger moves left to right
    onSwipeLeft?: () => void; // finger moves right to left
    distance?: number; // px the finger must travel before it counts
};

/**
 * A horizontal swipe for a whole screen, built on PanResponder so it never takes over
 * scrolling. It only claims a touch once the movement is clearly sideways, so vertical
 * scrolling (the feed) and taps keep working exactly as before. Fires once per swipe.
 *
 * Usage:  const swipe = useHorizontalSwipe({ ... });  <View {...swipe.panHandlers}> ... </View>
 */
export function useHorizontalSwipe({ onSwipeRight, onSwipeLeft, distance = 60 }: Options) {
    const rightRef = useRef(onSwipeRight);
    const leftRef = useRef(onSwipeLeft);
    rightRef.current = onSwipeRight;
    leftRef.current = onSwipeLeft;
    const fired = useRef(false);

    const responder = useMemo(
        () =>
            PanResponder.create({
                // Capture phase, so it can take over from a child, but only for clearly horizontal moves.
                onMoveShouldSetPanResponderCapture: (_, g) =>
                    Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
                onPanResponderGrant: () => {
                    fired.current = false;
                },
                onPanResponderMove: (_, g) => {
                    if (fired.current) return;
                    if (g.dx > distance) {
                        fired.current = true;
                        rightRef.current?.();
                    } else if (g.dx < -distance) {
                        fired.current = true;
                        leftRef.current?.();
                    }
                },
                onPanResponderTerminationRequest: () => true,
            }),
        [distance]
    );

    return { panHandlers: responder.panHandlers };
}