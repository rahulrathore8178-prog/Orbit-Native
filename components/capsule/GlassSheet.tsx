import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassPanel } from '../ui/capsule/GlassPanel';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  heightRatio?: number;
  children: React.ReactNode;
}

// Bottom glass sheet rendered inside the viewer. Drag the handle down to dismiss.
export function GlassSheet({ visible, onClose, title, heightRatio = 0.68, children }: Props) {
  const { height: H } = useWindowDimensions();
  const sheetH = H * heightRatio;
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(sheetH);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      y.value = withTiming(sheetH, { duration: 220 }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
  }, [visible, sheetH, y, unmount]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > sheetH * 0.22 || e.velocityY > 800) runOnJS(onClose)();
      else y.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, sheetH], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <>
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }, backdropStyle]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close panel" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior="padding"
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' }}
      >
        <Animated.View style={[{ height: sheetH }, sheetStyle]}>
          <GlassPanel
            edge="top"
            intensity={65}
            style={{ flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          >
            <GestureDetector gesture={drag}>
              <View className="items-center pb-2 pt-3">
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                {title ? <Text className="mt-3 text-[15px] font-semibold text-white">{title}</Text> : null}
              </View>
            </GestureDetector>
            <View style={{ flex: 1 }}>{children}</View>
          </GlassPanel>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
