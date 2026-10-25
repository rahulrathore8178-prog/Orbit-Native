import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useEffect, useRef } from "react";
import { Pressable } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { GlassCard } from "./GlassCard";
import { FriendStatus } from "./types";

const CONFIG: Record<FriendStatus, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  none: { icon: "person-add", label: "Add" },
  pending: { icon: "time-outline", label: "Requested" },
  incoming: { icon: "mail-unread-outline", label: "Respond" },
  friends: { icon: "checkmark-circle", label: "Friends" },
};

type Props = { status: FriendStatus; onPress: () => void };

function AddFriendButtonBase({ status, onPress }: Props) {
  const cfg = CONFIG[status];
  const active = status === "none" || status === "incoming"; // tappable states
  const scale = useSharedValue(1);
  const first = useRef(true);

  // small "pop" whenever the status changes (e.g. Add -> Requested)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 220 }));
  }, [status, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        disabled={!active}
        hitSlop={8}
        onPress={() => {
          if (status === "none") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <GlassCard
          variant={active ? "neo" : "glass"}
          radius={18}
          contentClassName="flex-row items-center px-3 py-2"
        >
          <Ionicons name={cfg.icon} size={15} color={active ? "#fff" : "#7a7a7a"} />
          <Animated.Text
            key={status}
            entering={FadeIn.duration(180)}
            className={`ml-1.5 text-xs font-semibold ${active ? "text-white" : "text-neutral-500"}`}
          >
            {cfg.label}
          </Animated.Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

export const AddFriendButton = memo(AddFriendButtonBase);
