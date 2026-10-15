import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAPSULE } from '../../constants/capsule/constants';
import type { CapsuleGroup, Rect } from '../../constants/capsule/types';
import { AddCapsuleCard } from './AddCapsuleCard';
import { CapsuleTrayItem } from './CapsuleTrayItem';

type Row = { key: 'add' } | CapsuleGroup;

interface Props {
  groups: CapsuleGroup[];
  currentUserId?: string;
  onAdd: () => void;
  onOpen: (userId: string, rect: Rect) => void;
}

export function useTrayHeight() {
  const { top } = useSafeAreaInsets();
  return top + CAPSULE.TRAY_ITEM_H + 24;
}

export function CapsuleTray({ groups, currentUserId, onAdd, onOpen }: Props) {
  const data: Row[] = [{ key: 'add' }, ...groups];

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      'key' in item ? (
        <AddCapsuleCard onPress={onAdd} />
      ) : (
        <CapsuleTrayItem group={item} isOwn={item.user.id === currentUserId} onOpen={onOpen} />
      ),
    [onAdd, onOpen, currentUserId],
  );

  return (
    <FlatList
      horizontal
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => ('key' in item ? 'add' : item.user.id)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      initialNumToRender={6}
      windowSize={5}
    />
  );
}
