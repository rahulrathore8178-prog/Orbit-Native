import { Globe } from 'lucide-react-native';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { MyOrbital } from '../../constants/createPost/external';
import { theme } from '../../constants/createPost/theme';
import { GlassCard } from '../ui/createPost/GlassCard';
import { NeoSurface } from '../ui/createPost/NeoSurface';
import { OrbitalPicker } from './OrbitalPicker';

type Props = {
  progress: SharedValue<number>;
  orbitals: MyOrbital[] | null;
  orbitalsStatus: 'idle' | 'loading' | 'failed';
  selectedOrbitalId: string | null;
  onSelectOrbital: (id: string) => void;
  onRetryOrbitals: () => void;
};

/** Page wrapper: fades + shrinks slightly as it moves away from the centre. */
function Page({ index, width, progress, children }: { index: number; width: number; progress: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const input = [index - 1, index, index + 1];
    return {
      opacity: interpolate(progress.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress.value, input, [0.96, 1, 0.96], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width }, style]}>{children}</Animated.View>;
}

/** Two pages side by side that slide with the finger: "Community feed" info and the orbital picker. */
export function DestinationPager({
  progress,
  orbitals,
  orbitalsStatus,
  selectedOrbitalId,
  onSelectOrbital,
  onRetryOrbitals,
}: Props) {
  const [width, setWidth] = useState(0);
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * width }] }));

  return (
    <View style={styles.clip} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View style={[{ flexDirection: 'row', width: width * 2 }, trackStyle]}>
          <Page index={0} width={width} progress={progress}>
            <GlassCard radius={22} style={styles.feedCard}>
              <NeoSurface radius={16} style={{ width: 44, height: 44 }}>
                <Globe size={20} color={theme.colors.accent} strokeWidth={2.1} />
              </NeoSurface>
              <View style={{ flex: 1 }}>
                <Text style={styles.feedTitle}>Community feed</Text>
                <Text style={styles.feedSub}>Visible to everyone in your community.</Text>
              </View>
            </GlassCard>
          </Page>

          <Page index={1} width={width} progress={progress}>
            <OrbitalPicker
              orbitals={orbitals}
              status={orbitalsStatus}
              selectedId={selectedOrbitalId}
              onSelect={onSelectOrbital}
              onRetry={onRetryOrbitals}
            />
          </Page>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  feedCard: {
    flexGrow: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  feedTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  feedSub: { color: theme.colors.textDim, fontSize: 12.5, marginTop: 3 },
});
