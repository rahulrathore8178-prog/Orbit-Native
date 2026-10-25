import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { theme } from '../../constants/createPost/theme';
import { GlassCard } from '../ui/createPost/GlassCard';

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <GlassCard radius={14} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 12.5, fontWeight: '600' }}>
            {message}
          </Text>
        </GlassCard>
      </View>
    </Animated.View>
  );
}
