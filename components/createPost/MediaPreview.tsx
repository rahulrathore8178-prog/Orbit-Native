import { Maximize2, RefreshCw, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { MediaViewer } from '../camera/MediaViewer'; // adjust path
import { VideoPreview } from '../../constants/createPost/external';
import type { PickedMedia } from '../../constants/createPost/types';
import { GlassCard } from '../ui/createPost/GlassCard';
import { NeoIconButton } from '../ui/createPost/NeoButton';

type Props = { media: PickedMedia; onChange: () => void; onRemove: () => void; onEdited: (m: PickedMedia) => void };

export function MediaPreview({ media, onChange, onRemove, onEdited }: Props) {
  const { height } = useWindowDimensions();
  const h = Math.round(Math.min(280, Math.max(170, height * 0.3)));
  const [viewer, setViewer] = useState(false);

  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)}>
      <GlassCard radius={24} style={{ height: h }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewer(true)}>
          <View style={{ flex: 1 }} pointerEvents="none">
            {media.kind === 'video'
              ? <VideoPreview uri={media.uri} />
              : <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
          </View>
        </Pressable>
        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>
          <NeoIconButton Icon={Maximize2} label="Open full screen" size={38} onPress={() => setViewer(true)} />
          <NeoIconButton Icon={RefreshCw} label="Change media" size={38} onPress={onChange} />
          <NeoIconButton Icon={Trash2} label="Remove media" size={38} onPress={onRemove} />
        </View>
      </GlassCard>

      <MediaViewer
        media={media}
        visible={viewer}
        onClose={() => setViewer(false)}
        onSave={(m) => { setViewer(false); onEdited(m); }}
      />
    </Animated.View>
  );
}