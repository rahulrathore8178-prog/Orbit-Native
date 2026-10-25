import type { LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../../../constants/createPost/theme';
import { NeoSurface, type NeoTone } from '../../ui/createPost/NeoSurface';

type Props = {
  onPress?: () => void;
  disabled?: boolean;
  /** sunken look for toggled-on / selected buttons */
  selected?: boolean;
  radius?: number;
  tone?: NeoTone;
  /** layout style (width / height / flex …) */
  style?: StyleProp<ViewStyle>;
  label?: string;
  children?: React.ReactNode;
};

/** Neumorphic button with a springy press (scale + sunken surface). */
export function NeoButton({
  onPress,
  disabled,
  selected,
  radius = theme.radius.md,
  tone = 'dark',
  style,
  label,
  children,
}: Props) {
  const [down, setDown] = useState(false);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      hitSlop={6}
      onPressIn={() => {
        setDown(true);
        scale.value = withTiming(0.96, { duration: 90 });
      }}
      onPressOut={() => {
        setDown(false);
        scale.value = withSpring(1, theme.spring);
      }}
      style={style}
    >
      <Animated.View style={[{ flexGrow: 1, alignSelf: 'stretch' }, anim]}>
        <NeoSurface radius={radius} tone={tone} pressed={down || !!selected} style={{ flexGrow: 1, alignSelf: 'stretch' }}>
          {children}
        </NeoSurface>
      </Animated.View>
    </Pressable>
  );
}

type IconProps = {
  Icon: LucideIcon;
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  selected?: boolean;
  disabled?: boolean;
};

/** Square neumorphic icon button. */
export function NeoIconButton({
  Icon,
  label,
  onPress,
  size = 44,
  color = theme.colors.text,
  selected,
  disabled,
}: IconProps) {
  return (
    <NeoButton
      onPress={onPress}
      label={label}
      selected={selected}
      disabled={disabled}
      radius={Math.round(size * 0.36)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.44)} color={color} strokeWidth={2.1} />
    </NeoButton>
  );
}
