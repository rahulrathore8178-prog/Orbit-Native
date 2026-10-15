import React from 'react';
import { View } from 'react-native';
import { COLORS } from '../../constants/capsule/constants';
import { STATIC_VIEWERS } from './staticViews';
import type { Capsule } from '../../constants/capsule/types';
import { GlassPanel } from '../ui/capsule/GlassPanel';
import { NeoButton } from '../ui/capsule/NeoButton';

interface Props {
  capsule: Capsule;
  onViews: () => void;
  onLikes: () => void;
  onComments: () => void;
  onSend: () => void;
  onDelete: () => void;
}

// Bottom glass panel for your own capsule: views, likes, comments, send, delete.
export function OwnerActionBar({ capsule, onViews, onLikes, onComments, onSend, onDelete }: Props) {
  return (
    <GlassPanel edge="top" intensity={50}>
      <View className="items-center pt-2">
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
      </View>
      <View className="flex-row items-start justify-around px-3 pb-3 pt-3">
        <NeoButton
          icon="eye-outline"
          label={STATIC_VIEWERS.length /* static until the views backend exists */}
          onPress={onViews}
          accessibilityLabel="See views"
        />
        <NeoButton
          icon="heart-outline"
          label={capsule.likesCount}
          onPress={onLikes}
          accessibilityLabel="See likes"
        />
        <NeoButton
          icon="chatbubble-outline"
          label={capsule.commentsCount}
          onPress={onComments}
          accessibilityLabel="See comments"
        />
        <NeoButton icon="paper-plane-outline" label="Send" onPress={onSend} accessibilityLabel="Send" />
        <NeoButton
          icon="trash-outline"
          color={COLORS.danger}
          label="Delete"
          onPress={onDelete}
          accessibilityLabel="Delete capsule"
        />
      </View>
    </GlassPanel>
  );
}
