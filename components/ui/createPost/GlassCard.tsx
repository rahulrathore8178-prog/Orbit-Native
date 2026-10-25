import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '@/constants/createPost/theme';

type Props = {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Frosted card. The sheet behind it is already blurred, so the card only adds a translucent fill,
 * a hairline border and a soft top highlight (cheap to render, smooth to animate).
 */
export function GlassCard({ radius = theme.radius.lg, style, children }: Props) {
  return (
    <View style={[styles.base, { borderRadius: radius }, style]}>
      <View pointerEvents="none" style={[styles.highlight, { borderRadius: radius }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  highlight: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassHighlight,
    opacity: 0.6,
  },
});
