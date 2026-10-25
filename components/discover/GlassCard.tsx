import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, View, ViewProps } from "react-native";

type Props = ViewProps & {
  variant?: "glass" | "neo";
  blur?: boolean; // use sparingly (header / panels). Never on every list row.
  radius?: number;
  contentClassName?: string;
};

/**
 * One surface for the whole feature.
 *  glass = translucent + hairline border + sheen
 *  neo   = raised grey surface, deep drop shadow, lit top-left edge
 * style is only used for shadows / gradients / blur (not expressible in className).
 */
function GlassCardBase({
  variant = "glass",
  blur = false,
  radius = 24,
  contentClassName = "",
  style,
  children,
  ...rest
}: Props) {
  const isNeo = variant === "neo";
  return (
    <View
      {...rest}
      style={[isNeo ? styles.neoShadow : styles.glassShadow, { borderRadius: radius }, style]}
    >
      <View
        className={`overflow-hidden ${contentClassName}`}
        style={[styles.inner, isNeo ? styles.neoInner : styles.glassInner, { borderRadius: radius }]}
      >
        {blur && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
        <LinearGradient
          pointerEvents="none"
          colors={
            isNeo
              ? ["rgba(255,255,255,0.09)", "rgba(255,255,255,0)"]
              : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    </View>
  );
}

export const GlassCard = memo(GlassCardBase);

const styles = StyleSheet.create({
  inner: { height: "100%" },
  glassShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  glassInner: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  neoShadow: {
    backgroundColor: "#141414",
    shadowColor: "#000",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 6, height: 6 },
    elevation: 10,
  },
  neoInner: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderTopColor: "rgba(255,255,255,0.15)",
    borderLeftColor: "rgba(255,255,255,0.15)",
  },
});
