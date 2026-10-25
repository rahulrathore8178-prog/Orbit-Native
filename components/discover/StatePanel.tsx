import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { GlassCard } from "./GlassCard";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Used for: empty result, permission denied, network/GPS error.
function StatePanelBase({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOut.duration(150)}
      className="absolute inset-0 items-center justify-center px-8"
    >
      <GlassCard blur radius={32} style={styles.panel} contentClassName="items-center px-6 py-8">
        <GlassCard variant="neo" radius={32} style={styles.icon} contentClassName="items-center justify-center">
          <Ionicons name={icon} size={28} color="#fff" />
        </GlassCard>
        <Text className="text-white text-lg font-bold mt-5 text-center">{title}</Text>
        <Text className="text-neutral-400 text-sm text-center mt-2 leading-5">{message}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="mt-6 active:opacity-70">
            <GlassCard variant="neo" radius={20} contentClassName="px-6 py-3">
              <Text className="text-white font-semibold">{actionLabel}</Text>
            </GlassCard>
          </Pressable>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

export const StatePanel = memo(StatePanelBase);

const styles = StyleSheet.create({
  panel: { width: "100%" },
  icon: { width: 64, height: 64 },
});
