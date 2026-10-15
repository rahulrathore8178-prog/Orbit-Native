import React from 'react';
import { Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { CapsuleUser } from '../../constants/capsule/types';
import { timeAgo } from '../../constants/capsule/time';
import { Avatar } from '../ui/capsule/Avatar';
import { GlassPanel } from '../ui/capsule/GlassPanel';
import { NeoButton } from '../ui/capsule/NeoButton';
import { CapsuleProgressBar } from './CapsuleProgressBar';

interface Props {
  count: number;
  activeIndex: number;
  progress: SharedValue<number>;
  user: CapsuleUser;
  createdAt: string;
  isOwn: boolean;
  onClose: () => void;
}

// Top glass panel: progress segments, avatar, name + time, close.
export function CapsuleHeader({
  count,
  activeIndex,
  progress,
  user,
  createdAt,
  isOwn,
  onClose,
}: Props) {
  return (
    <GlassPanel edge="bottom" intensity={50}>
      <View className="px-3 pb-3 pt-3">
        <CapsuleProgressBar count={count} activeIndex={activeIndex} progress={progress} />
        <View className="mt-3 flex-row items-center">
          <Avatar uri={user.avatar} size={38} />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-white" numberOfLines={1}>
              {isOwn ? 'Your Capsule' : user.username}
            </Text>
            <Text className="text-[12px] text-neutral-400">{timeAgo(createdAt)}</Text>
          </View>
          <NeoButton icon="close" size={36} onPress={onClose} accessibilityLabel="Close capsule" />
        </View>
      </View>
    </GlassPanel>
  );
}
