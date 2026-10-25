import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { DISCOVER_RADIUS_M } from "./constants";
import { GlassCard } from "./GlassCard";

const SIZE = 260;

// Expanding ring. Runs fully on the UI thread (reanimated) => no JS-thread jank.
function Ring({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [delay, p]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.2, 1]) }],
  }));

  return <Animated.View className="absolute rounded-full border border-white/40" style={[styles.full, style]} />;
}

function RadarScannerBase() {
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [sweep, pulse]);

  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value}deg` }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [0.45, 1]) }));

  return (
    <View className="items-center">
      <View className="items-center justify-center" style={styles.full}>
        {/* static guide circles */}
        <View className="absolute rounded-full border border-white/10" style={styles.full} />
        <View className="absolute rounded-full border border-white/10" style={styles.mid} />
        <View className="absolute rounded-full border border-white/10" style={styles.small} />

        <Ring delay={0} />
        <Ring delay={800} />
        <Ring delay={1600} />

        {/* rotating sweep line */}
        <Animated.View className="absolute items-center" style={[styles.full, sweepStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.7)"]}
            style={styles.sweepLine}
          />
        </Animated.View>

        <View style={styles.center}>
          <GlassCard variant="neo" radius={28} contentClassName="items-center justify-center">
            <Ionicons name="locate" size={26} color="#fff" />
          </GlassCard>
        </View>
      </View>

      <Animated.View style={textStyle} className="items-center mt-8">
        <Text className="text-white text-base font-semibold">Scanning your surroundings</Text>
        <Text className="text-neutral-500 text-xs mt-1">Looking within {DISCOVER_RADIUS_M} m</Text>
      </Animated.View>
    </View>
  );
}

export const RadarScanner = memo(RadarScannerBase);

const styles = StyleSheet.create({
  full: { width: SIZE, height: SIZE },
  mid: { width: SIZE * 0.66, height: SIZE * 0.66 },
  small: { width: SIZE * 0.33, height: SIZE * 0.33 },
  sweepLine: { width: 2, height: SIZE / 2 },
  center: { width: 56, height: 56 },
});
