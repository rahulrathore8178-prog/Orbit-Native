import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CAPSULE } from '../../constants/capsule/constants';

// Instagram-style: scroll down past the threshold → tray slides away,
// scroll up past the threshold (or reach the top) → tray comes back.
export function useCollapsibleTray(height: number, threshold: number = CAPSULE.HIDE_THRESHOLD) {
  const translateY = useSharedValue(0);
  const hidden = useSharedValue(false);
  const lastY = useSharedValue(0);
  const acc = useSharedValue(0);

  const setHidden = (v: boolean) => {
    'worklet';
    if (hidden.value === v) return;
    hidden.value = v;
    translateY.value = withTiming(v ? -height : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const maxY = e.contentSize.height - e.layoutMeasurement.height;
    const dy = y - lastY.value;
    lastY.value = y;

    if (y <= 0) {
      acc.value = 0;
      setHidden(false);
      return;
    }
    if (y > maxY) return; // ignore bottom bounce

    acc.value = Math.sign(dy) === Math.sign(acc.value) ? acc.value + dy : dy;
    if (acc.value > threshold && y > height) setHidden(true);
    else if (acc.value < -threshold) setHidden(false);
  });

  const trayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [-height, 0], [0, 1], Extrapolation.CLAMP),
  }));

  return { onScroll, trayStyle };
}
