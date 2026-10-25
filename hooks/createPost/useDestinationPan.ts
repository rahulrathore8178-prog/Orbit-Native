import { useCallback, useEffect, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useSharedValue, withSpring } from 'react-native-reanimated';
import { theme } from '../../constants/createPost/theme';
import type { Destination } from '../../constants/createPost/types';

/**
 * Feed ⇄ Orbital switching that follows the finger.
 *
 * `progress` is a fractional page position (0 = feed, 1 = orbital) shared by the tab pill and the
 * pager, so everything moves together. Redux owns the committed destination; this hook only
 * animates toward it and reports the final choice after a swipe.
 */
export function useDestinationPan(destination: Destination, onChange: (d: Destination) => void, enabled = true) {
  const index = destination === 'orbital' ? 1 : 0;
  const indexRef = useRef(index);
  indexRef.current = index;

  const progress = useSharedValue(index);
  const startIndex = useSharedValue(index);
  const pageWidth = useSharedValue(1);
  const skipSync = useRef(false);

  // taps (and anything else that changes redux) animate here; swipes already animated themselves
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    progress.value = withSpring(index, theme.spring);
  }, [index, progress]);

  const settle = useCallback(
    (target: number) => {
      if (target !== indexRef.current) skipSync.current = true;
      onChange(target === 1 ? 'orbital' : 'feed');
    },
    [onChange],
  );

  const setPageWidth = useCallback(
    (w: number) => {
      pageWidth.value = Math.max(1, w);
    },
    [pageWidth],
  );

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-18, 18]) // claim the touch only after a clear horizontal move…
    .failOffsetY([-14, 14]) // …so vertical scrolling of the sheet keeps working
    .onStart(() => {
      cancelAnimation(progress);
      startIndex.value = Math.round(progress.value);
    })
    .onUpdate((e) => {
      let next = startIndex.value - e.translationX / pageWidth.value;
      // rubber band past the edges
      if (next < 0) next *= 0.25;
      else if (next > 1) next = 1 + (next - 1) * 0.25;
      progress.value = next;
    })
    .onEnd((e) => {
      const projected = progress.value - (e.velocityX / pageWidth.value) * 0.2;
      const target = projected > 0.5 ? 1 : 0;
      progress.value = withSpring(target, { ...theme.spring, velocity: -e.velocityX / pageWidth.value });
      runOnJS(settle)(target);
    });

  return { progress, gesture, setPageWidth };
}
