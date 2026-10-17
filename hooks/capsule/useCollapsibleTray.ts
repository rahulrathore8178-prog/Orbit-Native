import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CAPSULE } from '@/constants/capsule/constants'; // adjust to where CAPSULE lives

/**
 * Hides the tray when scrolling down, shows it when scrolling up.
 * `onScroll` MUST be given to a Reanimated scrollable (Reanimated.FlatList),
 * not to React Native's core Animated.FlatList.
 */
export function useCollapsibleTray(height: number, threshold: number = CAPSULE.HIDE_THRESHOLD) {
  const translateY = useSharedValue(0);
  const hidden = useSharedValue(false);
  const lastY = useSharedValue(0);
  const acc = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const maxY = e.contentSize.height - e.layoutMeasurement.height;
    const dy = y - lastY.value;
    lastY.value = y;

    let next: boolean | null = null; // null = leave the tray as it is

    if (y <= 0) {
      acc.value = 0;
      next = false; // at the top (or pulling to refresh): always show
    } else if (y > maxY) {
      return; // ignore bottom bounce
    } else {
      // accumulate scroll in the current direction; reset when direction flips
      acc.value = Math.sign(dy) === Math.sign(acc.value) ? acc.value + dy : dy;
      if (acc.value > threshold && y > height) next = true;
      else if (acc.value < -threshold) next = false;
    }

    // everything is inlined on purpose: no helper worklet capturing shared values
    if (next !== null && next !== hidden.value) {
      hidden.value = next;
      translateY.value = withTiming(next ? -height : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }
  });

  const trayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [-height, 0], [0, 1], Extrapolation.CLAMP),
  }));

  return { onScroll, trayStyle };
}