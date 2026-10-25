import { memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DISCOVER_RADIUS_M } from "./constants";
import { GlassCard } from "./GlassCard";
import { NeoIconButton } from "./NeoIconButton";

type Props = {
  count: number;
  isScanning: boolean;
  onBackPress: () => void;
  onReload: () => void;
};

function DiscoverHeaderBase({ count, isScanning, onBackPress, onReload }: Props) {
  const insets = useSafeAreaInsets();
  const subtitle = isScanning
    ? `Scanning ${DISCOVER_RADIUS_M} m around you…`
    : count === 0
      ? `Nobody within ${DISCOVER_RADIUS_M} m`
      : `${count} ${count === 1 ? "person" : "people"} within ${DISCOVER_RADIUS_M} m`;

  return (
    <View className="px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <GlassCard blur radius={28}>
        <View className="flex-row items-center px-3 py-3">
          <NeoIconButton icon="arrow-back" onPress={onBackPress} />
          <View className="flex-1 mx-3">
            <Text className="text-white text-lg font-bold">Discover</Text>
            <Animated.Text key={subtitle} entering={FadeIn.duration(250)} className="text-neutral-400 text-xs mt-0.5">
              {subtitle}
            </Animated.Text>
          </View>
          <NeoIconButton icon="refresh" onPress={onReload} spinning={isScanning} />
        </View>
      </GlassCard>
    </View>
  );
}

export const DiscoverHeader = memo(DiscoverHeaderBase);
