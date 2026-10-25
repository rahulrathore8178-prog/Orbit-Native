import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet } from "react-native";

// Static black -> grey wash. No animation = zero cost per frame.
function AmbientBackgroundBase() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["#1a1a1a", "#0a0a0a", "#000000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
export const AmbientBackground = memo(AmbientBackgroundBase);
