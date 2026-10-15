import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/capsule/constants';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface CropEditorHandle {
  getCrop: () => CropRect; // in ORIGINAL image pixels
  reset: () => void;
}

interface Props {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  radius?: number;
}

const MAX_ZOOM = 5;
const SPRING = { damping: 20, stiffness: 220 };

// Pan + pinch the photo inside a fixed capsule frame. Double-tap resets.
export const CropEditor = forwardRef<CropEditorHandle, Props>(function CropEditor(
  { uri, imageWidth, imageHeight, frameWidth: FW, frameHeight: FH, radius = 40 },
  ref,
) {
  // "cover" size of the image inside the frame at zoom 1
  const base = Math.max(FW / imageWidth, FH / imageHeight);
  const w = imageWidth * base;
  const h = imageHeight * base;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const grid = useSharedValue(0);

  const clamp = (v: number, max: number) => {
    'worklet';
    return Math.min(Math.max(v, -max), max);
  };
  const limits = (s: number) => {
    'worklet';
    return { mx: Math.max((w * s - FW) / 2, 0), my: Math.max((h * s - FH) / 2, 0) };
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      grid.value = withTiming(1, { duration: 120 });
    })
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const { mx, my } = limits(scale.value);
      tx.value = clamp(startX.value + e.translationX, mx);
      ty.value = clamp(startY.value + e.translationY, my);
    })
    .onFinalize(() => {
      grid.value = withTiming(0, { duration: 200 });
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      grid.value = withTiming(1, { duration: 120 });
    })
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_ZOOM);
      scale.value = s;
      const { mx, my } = limits(s);
      tx.value = clamp(tx.value, mx);
      ty.value = clamp(ty.value, my);
    })
    .onFinalize(() => {
      grid.value = withTiming(0, { duration: 200 });
    });

  const resetAnimated = () => {
    'worklet';
    scale.value = withSpring(1, SPRING);
    tx.value = withSpring(0, SPRING);
    ty.value = withSpring(0, SPRING);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, ok) => {
      if (ok) resetAnimated();
    });

  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  useImperativeHandle(ref, () => ({
    reset: () => {
      scale.value = withSpring(1, SPRING);
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
    },
    getCrop: () => {
      const k = base * scale.value; // display px per original px
      const dw = imageWidth * k;
      const dh = imageHeight * k;
      const cw = Math.min(Math.round(FW / k), imageWidth);
      const ch = Math.min(Math.round(FH / k), imageHeight);
      const x0 = Math.round((dw / 2 - FW / 2 - tx.value) / k);
      const y0 = Math.round((dh / 2 - FH / 2 - ty.value) / k);
      return {
        originX: Math.max(0, Math.min(x0, imageWidth - cw)),
        originY: Math.max(0, Math.min(y0, imageHeight - ch)),
        width: cw,
        height: ch,
      };
    },
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: grid.value * 0.5 }));

  const line = { position: 'absolute' as const, backgroundColor: '#FFFFFF' };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          width: FW,
          height: FH,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.glassBorder,
        }}
      >
        <Animated.View
          style={[{ position: 'absolute', left: (FW - w) / 2, top: (FH - h) / 2, width: w, height: h }, imageStyle]}
        >
          <Image source={{ uri }} style={{ width: w, height: h }} contentFit="cover" />
        </Animated.View>

        {/* rule-of-thirds grid, visible only while dragging */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, gridStyle]}>
          <View style={[line, { left: FW / 3, top: 0, bottom: 0, width: 1 }]} />
          <View style={[line, { left: (FW * 2) / 3, top: 0, bottom: 0, width: 1 }]} />
          <View style={[line, { top: FH / 3, left: 0, right: 0, height: 1 }]} />
          <View style={[line, { top: (FH * 2) / 3, left: 0, right: 0, height: 1 }]} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
});
