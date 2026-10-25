import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { GlassCard } from "./GlassCard";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  spinning?: boolean; // used by the reload button while scanning
  size?: number;
};

function NeoIconButtonBase({ icon, onPress, spinning = false, size = 44 }: Props) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
    } else if (rotation.value % 360 !== 0) {
      // finish the current turn smoothly instead of snapping back
      cancelAnimation(rotation);
      rotation.value = withTiming(360, { duration: 300, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) rotation.value = 0;
      });
    }
  }, [spinning, rotation]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Pressable
      hitSlop={8}
      onPressIn={() => (scale.value = withSpring(0.9, { damping: 15, stiffness: 300 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 260 }))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={[{ width: size, height: size }, pressStyle]}>
        <GlassCard variant="neo" radius={size / 2} contentClassName="items-center justify-center">
          <Animated.View style={iconStyle}>
            <Ionicons name={icon} size={size * 0.46} color="#fff" />
          </Animated.View>
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
}

export const NeoIconButton = memo(NeoIconButtonBase);
