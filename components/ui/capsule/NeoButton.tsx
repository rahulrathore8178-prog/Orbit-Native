import React, { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { COLORS } from '../../../constants/capsule/constants';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  label?: string | number;
  disabled?: boolean;
}

const SPRING = { damping: 15, stiffness: 320 };

// Neomorphic round button: light shadow top-left, dark shadow bottom-right,
// gradient flips when pressed. (The light shadow is iOS-only; Android gets
// the dark elevation + gradient + hairline border.)
function NeoButtonBase({
  icon,
  accessibilityLabel,
  onPress,
  size = 46,
  color = COLORS.text,
  label,
  disabled,
}: Props) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const r = size / 2;

  return (
    <View className="items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        hitSlop={6}
        onPressIn={() => {
          scale.value = withSpring(0.92, SPRING);
          setPressed(true);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING);
          setPressed(false);
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
      >
        <Animated.View style={animated}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: r,
              backgroundColor: COLORS.neoBottom,
              shadowColor: '#FFFFFF',
              shadowOffset: { width: -3, height: -3 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: r,
                backgroundColor: COLORS.neoBottom,
                shadowColor: '#000',
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 0.9,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <LinearGradient
                colors={
                  pressed ? [COLORS.neoBottom, COLORS.neoTop] : [COLORS.neoTop, COLORS.neoBottom]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  borderRadius: r,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                }}
              >
                <Ionicons name={icon} size={size * 0.46} color={color} />
              </LinearGradient>
            </View>
          </View>
        </Animated.View>
      </Pressable>
      {label !== undefined && (
        <Text className="mt-1.5 text-[11px] text-neutral-400">{label}</Text>
      )}
    </View>
  );
}

export const NeoButton = memo(NeoButtonBase);
