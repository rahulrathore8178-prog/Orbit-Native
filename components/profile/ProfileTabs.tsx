import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GlassPanel } from '@/components/ui/neo';
import { ProfileTabKey } from '@/components/profile/profile';

const TABS: { key: ProfileTabKey; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'friends', label: 'Friends' },
];

type Props = {
  active: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
  counts: Record<ProfileTabKey, number>;
};

export default function ProfileTabs({ active, onChange, counts }: Props) {
  const [width, setWidth] = useState(0);
  const index = useSharedValue(0);
  const tabWidth = width / TABS.length;

  useEffect(() => {
    index.value = withTiming(TABS.findIndex((t) => t.key === active), {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, index]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: index.value * tabWidth }] }));

  return (
    <GlassPanel radius={22} style={{ padding: 4 }}>
      <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: tabWidth }, slide]}>
            <View className="h-full w-full rounded-[18px] bg-white/10" />
          </Animated.View>
        )}

        {TABS.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
            >
              <Text className="text-sm font-bold text-white">{counts[key]}</Text>
              <Text className={`text-sm ${isActive ? 'font-medium text-white' : 'text-neutral-500'}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassPanel>
  );
}