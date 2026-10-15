import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CAPSULE, COLORS } from '../../constants/capsule/constants';
import type { CapsuleGroup, Rect } from '../../constants/capsule/types';

interface Props {
  group: CapsuleGroup;
  isOwn: boolean;
  onOpen: (userId: string, rect: Rect) => void;
}

const W = CAPSULE.TRAY_ITEM_W;
const H = CAPSULE.TRAY_ITEM_H;

function CapsuleTrayItemBase({ group, isOwn, onOpen }: Props) {
  const ref = useRef<View>(null);
  const cover = group.capsules[group?.capsules?.length - 1];
  const unseen = group.capsules.some((c) => !c.seen);
  const ring = isOwn || unseen ? COLORS.accent : 'rgba(255,255,255,0.18)';

  // Measure so the viewer can grow out of (and shrink back into) this pill.
  const press = () =>
    ref.current?.measureInWindow((x, y, width, height) =>
      onOpen(group.user.id, { x, y, width, height }),
    );

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.user.username}'s capsule`}
    >
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: W,
          height: H,
          borderRadius: W / 2,
          borderWidth: 2,
          borderColor: ring,
          padding: 2,
          backgroundColor: COLORS.surface,
        }}
      >
        <View style={{ flex: 1, borderRadius: W / 2 - 4, overflow: 'hidden' }}>
          <Image
            source={{ uri: cover?.mediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={cover?.id}
            transition={120}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 }}
          />
          <Text
            numberOfLines={1}
            className="absolute bottom-2 left-2 right-2 text-center text-[12px] font-semibold text-white"
          >
            {group.user.username}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const CapsuleTrayItem = memo(CapsuleTrayItemBase);
