import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '@/constants/createPost/theme';

export type NeoTone = 'dark' | 'light';

type Props = {
  radius?: number;
  /** pressed / selected look: sunken instead of raised */
  pressed?: boolean;
  tone?: NeoTone;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Soft-UI surface: a raised face with a light top/left edge, a dark bottom/right edge and a soft
 * drop shadow. When `pressed` the edges swap and the shadow flattens so it reads as sunken.
 */
export function NeoSurface({ radius = theme.radius.md, pressed = false, tone = 'dark', style, children }: Props) {
  const c = theme.colors;
  const light = tone === 'light';
  const fill = light ? (pressed ? c.postFillPressed : c.postFill) : pressed ? c.neoPressed : c.neo;
  const hi = light ? 'rgba(255,255,255,0.95)' : c.neoHighlight;
  const lo = light ? 'rgba(0,0,0,0.14)' : c.neoShade;

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: fill,
          borderTopColor: pressed ? lo : hi,
          borderLeftColor: pressed ? lo : hi,
          borderBottomColor: pressed ? hi : lo,
          borderRightColor: pressed ? hi : lo,
          shadowOffset: { width: 0, height: pressed ? 1 : 6 },
          shadowOpacity: pressed ? 0.15 : light ? 0.35 : 0.5,
          shadowRadius: pressed ? 3 : 12,
          elevation: pressed ? 1 : 7,
        },
        style,
      ]}
    >
      {!pressed && (
        <View
          pointerEvents="none"
          style={[styles.gloss, { borderTopLeftRadius: radius, borderTopRightRadius: radius }, light && styles.glossLight]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    shadowColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  glossLight: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
