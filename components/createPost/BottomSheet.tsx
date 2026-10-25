import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/createPost/theme';
import { useKeyboardInset } from '@/hooks/createPost/useKeyboardInset';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** false while something is in flight (e.g. posting): blocks backdrop tap, back button and drag */
  dismissible?: boolean;
  children: React.ReactNode;
};

/**
 * Bottom-anchored glass sheet.
 *  - safe areas: top inset keeps it below the notch, bottom inset keeps the footer above the home bar
 *  - keyboard: lifts by exactly what the keyboard covers; the sheet shrinks instead of overflowing
 *  - drag the grabber down to dismiss
 *  - capped width on tablets / landscape
 */
export function BottomSheet({ visible, onClose, dismissible = true, children }: Props) {
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(windowH);
  const backdrop = useSharedValue(0);
  const sheetH = useSharedValue(windowH);

  const rootRef = useRef<View>(null);
  const keyboard = useKeyboardInset(rootRef);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withSpring(0, theme.sheetSpring);
      backdrop.value = withTiming(1, { duration: 260 });
    } else {
      backdrop.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(
        sheetH.value + 40,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, translateY, backdrop, sheetH]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      backdrop.value = 1 - Math.min(1, e.translationY / Math.max(1, sheetH.value)) * 0.8;
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, theme.sheetSpring);
        backdrop.value = withTiming(1, { duration: 180 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.62 }));
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: keyboard.overlap.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    // home-bar inset while the keyboard is down, a small gap while it is up (it already covers the inset)
    paddingBottom: interpolate(keyboard.visible.value, [0, 1], [Math.max(insets.bottom, 12), 12]),
  }));

  if (!mounted) return null;

  const close = () => dismissible && onClose();

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={styles.flex}>
        <View ref={rootRef} collapsable={false} onLayout={keyboard.onLayout} style={styles.flex}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.backdrop }, backdropStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close composer" />

          <Animated.View
            pointerEvents="box-none"
            style={[styles.lift, { paddingTop: insets.top + 8 }, liftStyle]}
          >
            <Animated.View
              style={[styles.sheet, sheetStyle]}
              onLayout={(e) => {
                sheetH.value = e.nativeEvent.layout.height;
              }}
            >
              <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.sheetTint }]} />
              <View pointerEvents="none" style={styles.topHighlight} />

              <GestureDetector gesture={pan}>
                <View style={styles.grabberArea} accessibilityLabel="Drag down to close">
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>

              {children}
            </Animated.View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lift: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flexShrink: 1,
    width: '100%',
    maxWidth: theme.sheetMaxWidth,
    alignSelf: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.colors.sheetBorder,
    backgroundColor: 'rgba(10,12,18,0.5)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  grabberArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
});
