import { RefreshCw, Trash2 } from 'lucide-react-native';
import { Image, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { VideoPreview } from '../../constants/createPost/external';
import type { PickedMedia } from '../../constants/createPost/types';
import { GlassCard } from '../ui/createPost/GlassCard';
import { NeoIconButton } from '../ui/createPost/NeoButton';

type Props = { media: PickedMedia; onChange: () => void; onRemove: () => void };

export function MediaPreview({ media, onChange, onRemove }: Props) {
  const { height } = useWindowDimensions();
  // scales with the screen so it never swallows the whole sheet on small phones / landscape
  const h = Math.round(Math.min(280, Math.max(170, height * 0.3)));

  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)}>
      <GlassCard radius={24} style={{ height: h }}>
        {media.kind === 'video' ? (
          <VideoPreview uri={media.uri} />
        ) : (
          <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        )}
        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>
          <NeoIconButton Icon={RefreshCw} label="Change media" size={38} onPress={onChange} />
          <NeoIconButton Icon={Trash2} label="Remove media" size={38} onPress={onRemove} />
        </View>
      </GlassCard>
    </Animated.View>
  );
}
