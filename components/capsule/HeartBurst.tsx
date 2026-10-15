import React, { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/capsule/constants';

const SIZE = 96;

export function useHeartBurst() {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const play = useCallback(
    (px: number, py: number) => {
      x.value = px;
      y.value = py;
      scale.value = 0.3;
      opacity.value = 1;
      scale.value = withSpring(1.15, { damping: 8, stiffness: 200 });
      opacity.value = withDelay(450, withTiming(0, { duration: 250 }));
    },
    [x, y, scale, opacity],
  );

  return { x, y, scale, opacity, play };
}

interface Props {
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}

export function HeartBurst({ x, y, scale, opacity }: Props) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - SIZE / 2 },
      { translateY: y.value - SIZE / 2 },
      { scale: scale.value },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name="heart" size={84} color={COLORS.like} />
    </Animated.View>
  );
}
