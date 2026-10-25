import React from 'react';
import { View } from 'react-native';
import { COLORS } from '../../constants/capsule/constants';
import type { Capsule } from '../../constants/capsule/types';
import { GlassPanel } from '../ui/capsule/GlassPanel';
import { NeoButton } from '../ui/capsule/NeoButton';

interface Props {
  capsule: Capsule;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onSend: () => void;
}

// Bottom glass panel for other people's capsules: like, comment, preserve, send.
export function ViewerActionBar({ capsule, onLike, onComment, onSave, onSend }: Props) {
  return (
    <GlassPanel edge="top" intensity={50}>
      <View className="items-center pt-2">
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
      </View>
      <View className="flex-row items-center justify-around px-4 pb-4 pt-3">
        <NeoButton
          icon={capsule.likedByMe ? 'heart' : 'heart-outline'}
          color={capsule.likedByMe ? COLORS.like : COLORS.text}
          onPress={onLike}
          accessibilityLabel={capsule.likedByMe ? 'Unlike' : 'Like'}
        />
        <NeoButton icon="chatbubble-outline" onPress={onComment} accessibilityLabel="Comment" />
        {/* <NeoButton
          icon={capsule.savedByMe ? 'bookmark' : 'bookmark-outline'}
          color={capsule.savedByMe ? COLORS.accent : COLORS.text}
          onPress={onSave}
          accessibilityLabel={capsule.savedByMe ? 'Remove from saved' : 'Preserve capsule'}
        />
        <NeoButton icon="paper-plane-outline" onPress={onSend} accessibilityLabel="Send" /> */}
      </View>
    </GlassPanel>
  );
}
