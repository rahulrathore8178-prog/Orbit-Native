import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GlassPanel } from '@/components/ui/neo';
import { ProfileTabKey } from '@/components/profile/profile';

export const TAB_LABELS: Record<ProfileTabKey, string> = {
  posts: 'Posts',
  friends: 'Friends',
  requests: 'Requests',
};

type Props = {
  /** Tabs to show, in order. Orbitals/Requests are decided by the screen. */
  tabs: ProfileTabKey[];
  active: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
  counts: Partial<Record<ProfileTabKey, number>>;
  /** Passed by the screen for the swipe pager; the pill animates from `active`, so this is unused here. */
  progress?: SharedValue<number>;
};

export default function ProfileTabs({ tabs, active, onChange, counts }: Props) {
  const [width, setWidth] = useState(0);
  const index = useSharedValue(0);
  const tabWidth = width / tabs.length;

  useEffect(() => {
    index.value = withTiming(Math.max(0, tabs.indexOf(active)), {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, tabs, index]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: index.value * tabWidth }] }));

  return (
    <GlassPanel radius={22} style={{ padding: 4 }}>
      <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: tabWidth }, slide]}>
            <View className="h-full w-full rounded-[18px] bg-white/10" />
          </Animated.View>
        )}

        {tabs.map((key) => {
          const isActive = key === active;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              className="flex-1 flex-row items-center justify-center gap-1 py-2.5"
            >
              <Text className="text-sm font-bold text-white">{counts[key] ?? 0}</Text>
              <Text
                numberOfLines={1}
                className={`text-sm ${isActive ? 'font-medium text-white' : 'text-neutral-500'}`}
              >
                {TAB_LABELS[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassPanel>
  );
}