import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../../constants/capsule/constants';

type Edge = 'all' | 'top' | 'bottom' | 'none';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  edge?: Edge; // which side gets the hairline border (for panels that sit flush to an edge)
}

// Glassmorphic panel: blur + tinted glass + faint top highlight.
export function GlassPanel({ children, style, intensity = 45, edge = 'all' }: Props) {
  const border: ViewStyle =
    edge === 'all'
      ? { borderWidth: 1, borderColor: COLORS.glassBorder }
      : edge === 'top'
        ? { borderTopWidth: 1, borderTopColor: COLORS.glassBorder }
        : edge === 'bottom'
          ? { borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder }
          : {};

  return (
    <View style={[{ overflow: 'hidden' }, border, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.glass }]} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
