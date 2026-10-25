import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, type View } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Tracks how much of `ref`'s view the keyboard actually covers.
 *
 * - `overlap`: pixels to pad at the bottom so content sits above the keyboard.
 * - `visible`: 0 → 1 while the keyboard is up (used to drop the safe-area padding).
 * - `onLayout`: attach to the same view so we re-measure if the system resizes it.
 *
 * It measures on screen instead of guessing, so it is correct whether Android resized the window
 * (adjustResize / edge-to-edge) or not, and on iOS where the window never resizes.
 */
export function useKeyboardInset(ref: React.RefObject<View | null>) {
  const overlap = useSharedValue(0);
  const visible = useSharedValue(0);
  const keyboardTop = useRef<number | null>(null);
  const duration = useRef(200);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animate = useCallback(
    (value: number, shown: number) => {
      const config = { duration: duration.current, easing: Easing.out(Easing.cubic) };
      overlap.value = withTiming(value, config);
      visible.value = withTiming(shown, config);
    },
    [overlap, visible],
  );

  const recompute = useCallback(() => {
    if (keyboardTop.current == null) return animate(0, 0);
    ref.current?.measureInWindow((_x, y, _w, h) => {
      if (keyboardTop.current == null) return;
      animate(Math.max(0, Math.round(y + h - keyboardTop.current)), 1);
    });
  }, [ref, animate]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      duration.current = ios ? e.duration || 250 : 180;
      if (timer.current) clearTimeout(timer.current);
      // iOS: window never resizes, measure now. Android: let the resize land first.
      if (ios) recompute();
      else timer.current = setTimeout(recompute, 60);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      keyboardTop.current = null;
      duration.current = ios ? e.duration || 250 : 180;
      if (timer.current) clearTimeout(timer.current);
      animate(0, 0);
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [recompute, animate]);

  const onLayout = useCallback(() => {
    if (keyboardTop.current != null) recompute();
  }, [recompute]);

  return { overlap, visible, onLayout };
}
