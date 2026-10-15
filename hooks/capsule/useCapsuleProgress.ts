import { useCallback, useEffect, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Options {
  duration: number;
  paused: boolean;
  resetKey: string;
  onComplete: () => void;
}

// Drives the 0 → 1 progress of the active capsule on the UI thread.
export function useCapsuleProgress({ duration, paused, resetKey, onComplete }: Options) {
  const progress = useSharedValue(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const complete = useCallback(() => completeRef.current(), []);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
  }, [resetKey, progress]);

  useEffect(() => {
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining = duration * (1 - progress.value);
    progress.value = withTiming(
      1,
      { duration: Math.max(remaining, 1), easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(complete)();
      },
    );
    return () => cancelAnimation(progress);
  }, [paused, resetKey, duration, progress, complete]);

  return progress;
}
