import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { AddFriendButton } from "./AddFriendButton";
import { CARD_HEIGHT } from "./constants";
import { GlassCard } from "./GlassCard";
import { NearbyUser } from "./types";
import { ChevronRight } from "lucide-react-native";

type Props = {
  user: NearbyUser;
  index: number;
  onOpenProfile: (id: string) => void;
  onAddFriend: (id: string) => void;
};

const formatDistance = (m: number) => (m < 30 ? "Right next to you" : `${m} m away`);

function NearbyUserCardBase({ user, index, onOpenProfile, onAddFriend }: Props) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const openProfile = useCallback(() => onOpenProfile(user._id), [onOpenProfile, user._id]);
  const onAction = useCallback(() => {
    // "incoming" = they already asked me -> open their profile to respond
    if (user.friendStatus === "incoming") onOpenProfile(user._id);
    else onAddFriend(user._id);
  }, [user._id, user.friendStatus, onOpenProfile, onAddFriend]);

  return (
    // entering only for the first rows: later rows are created while scrolling, keep those instant
    <Animated.View
      entering={index < 10 ? FadeInDown.delay(index * 60).springify().damping(18) : undefined}
      className="mb-3"
      style={styles.row}
    >
      <Animated.View style={pressStyle}>
        <GlassCard radius={24} style={styles.row}>
          <Pressable
            onPress={openProfile}
            onPressIn={() => (scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }))}
            onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 260 }))}
            className="flex-row items-center px-3"
            style={styles.fill}
          >
            <GlassCard variant="neo" radius={28} style={styles.avatarBox} contentClassName="items-center justify-center">
              {user.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text className="text-white text-lg font-bold">{user.username.charAt(0).toUpperCase()}</Text>
              )}
            </GlassCard>

            <View className="flex-1 mx-3">
              <Text className="text-white text-base font-semibold" numberOfLines={1}>
                {user.username}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="navigate-outline" size={12} color="#8a8a8a" />
                <Text className="text-neutral-400 text-xs ml-1">{formatDistance(user.distance)}</Text>
              </View>
            </View>

            {/* <AddFriendButton status={user.friendStatus} onPress={onAction} /> */}
            <ChevronRight size={20} color="#8a8a8a" />
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

export const NearbyUserCard = memo(NearbyUserCardBase);

const styles = StyleSheet.create({
  row: { height: CARD_HEIGHT },
  fill: { height: "100%" },
  avatarBox: { width: 56, height: 56 },
  avatar: { width: 56, height: 56 },
});
