import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    SharedValue,
    interpolateColor,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { theme } from '../../constants/createPost/theme';
import { DESTINATIONS } from '@/constants/createPost/constants';
import type { Destination } from '../../constants/createPost/types';
import { GlassCard } from '../ui/createPost/GlassCard';
import { NeoSurface } from '../ui/createPost/NeoSurface';

const PAD = 6;

function TabLabel({ label, index, progress }: { label: string; index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(Math.abs(progress.value - index), 1),
      [0, 1],
      [theme.colors.text, theme.colors.muted],
    ),
  }));
  return <Animated.Text style={[styles.label, style]}>{label}</Animated.Text>;
}

type Props = {
  progress: SharedValue<number>;
  onSelect: (d: Destination) => void;
  disabled?: boolean;
};

/** Glass track with a neumorphic pill that follows the swipe. */
export function DestinationTabs({ progress, onSelect, disabled }: Props) {
  const [width, setWidth] = useState(0);
  const tabW = width > 0 ? (width - PAD * 2) / DESTINATIONS.length : 0;

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * tabW }] }));

  return (
    <GlassCard radius={22} style={{ height: 56 }}>
      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {tabW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: PAD, top: PAD, bottom: PAD, width: tabW }, pillStyle]}
          >
            <NeoSurface radius={16} style={{ flexGrow: 1, alignSelf: 'stretch' }} />
          </Animated.View>
        )}
        <View style={{ flex: 1, flexDirection: 'row', padding: PAD }}>
          {DESTINATIONS.map((d, i) => (
            <Pressable
              key={d.value}
              disabled={disabled}
              style={styles.tab}
              onPress={() => onSelect(d.value)}
              accessibilityRole="tab"
            >
              <TabLabel label={d.label} index={i} progress={progress} />
            </Pressable>
          ))}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14.5, fontWeight: '800', letterSpacing: 0.3 },
});
