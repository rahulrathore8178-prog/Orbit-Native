import { useEffect, useState } from 'react';
import {
    GestureResponderEvent,
    PanResponder,
    PanResponderGestureState,
    PanResponderInstance,
} from 'react-native';

export type SwipeOptions = {
    /** Fires once per swipe, when the finger has travelled `distance` to the right. */
    onSwipeRight?: () => void;
    /** Fires once per swipe, when the finger has travelled `distance` to the left. */
    onSwipeLeft?: () => void;
    /** Fingers goes down on a swipe we claimed (use it to snapshot your starting state). */
    onStart?: () => void;
    /** Live finger travel in px since the swipe was claimed. Starts at 0, no jump. */
    onDrag?: (dx: number) => void;
    /** Finger lifted or the gesture was cancelled. `vx` is px/ms (positive = rightwards). */
    onRelease?: (info: { dx: number; vx: number }) => void;
    /** px the finger must travel before onSwipeLeft/Right fire. Default 60. */
    distance?: number;
    /** Don't let a child (e.g. a ScrollView) take the gesture back once we own it. */
    blockTermination?: boolean;
};

/**
 * All mutable gesture state lives in this plain class instead of in refs, so the hook stays
 * valid under the React Compiler (it forbids reading/writing refs while rendering).
 */
class SwipeSession {
    readonly responder: PanResponderInstance;
    private options: SwipeOptions;
    private fired = false;
    private startDx = 0;

    constructor(options: SwipeOptions) {
        this.options = options;
        this.responder = PanResponder.create({
            // Capture phase, so it can take over from a child, but only for clearly horizontal moves.
            onMoveShouldSetPanResponderCapture: this.shouldCapture,
            onPanResponderGrant: this.grant,
            onPanResponderMove: this.move,
            onPanResponderRelease: this.end,
            onPanResponderTerminate: this.end,
            onPanResponderTerminationRequest: () => !this.options.blockTermination,
        });
    }

    setOptions(options: SwipeOptions) {
        this.options = options;
    }

    private shouldCapture = (_: GestureResponderEvent, g: PanResponderGestureState) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2;

    private grant = (_: GestureResponderEvent, g: PanResponderGestureState) => {
        this.fired = false;
        this.startDx = g.dx; // the ~20px travelled before we captured, so drag starts at 0
        this.options.onStart?.();
    };

    private move = (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const { distance = 60, onDrag, onSwipeLeft, onSwipeRight } = this.options;
        onDrag?.(g.dx - this.startDx);
        if (this.fired) return;
        if (g.dx > distance) {
            this.fired = true;
            onSwipeRight?.();
        } else if (g.dx < -distance) {
            this.fired = true;
            onSwipeLeft?.();
        }
    };

    private end = (_: GestureResponderEvent, g: PanResponderGestureState) => {
        this.options.onRelease?.({ dx: g.dx - this.startDx, vx: g.vx });
    };
}

/**
 * A horizontal swipe for a whole screen, built on PanResponder so it never takes over
 * scrolling. It only claims a touch once the movement is clearly sideways, so vertical
 * scrolling (the feed) and taps keep working. onSwipeLeft/Right fire once per swipe;
 * onStart/onDrag/onRelease give you the live finger position for finger-following UIs.
 *
 * Usage:  const swipe = useHorizontalSwipe({ ... });  <View {...swipe.panHandlers}> ... </View>
 */
export function useHorizontalSwipe(options: SwipeOptions) {
    const [session] = useState(() => new SwipeSession(options));

    // Handlers always see the latest callbacks, without the gesture being rebuilt mid-swipe.
    useEffect(() => {
        session.setOptions(options);
    });

    return { panHandlers: session.responder.panHandlers };
}
