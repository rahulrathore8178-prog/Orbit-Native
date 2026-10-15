import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CAPSULE } from '../../constants/capsule/constants';
import { NeoButton } from '../ui/capsule/NeoButton';

function AddCapsuleCardBase({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add a capsule"
      style={{
        width: CAPSULE.TRAY_ITEM_W,
        height: CAPSULE.TRAY_ITEM_H,
        borderRadius: CAPSULE.TRAY_ITEM_W / 2,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.22)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View pointerEvents="none">
        <NeoButton icon="add" size={36} accessibilityLabel="Add" />
      </View>
      <Text className="mt-2 text-[12px] text-neutral-500">Add</Text>
    </Pressable>
  );
}

export const AddCapsuleCard = memo(AddCapsuleCardBase);
