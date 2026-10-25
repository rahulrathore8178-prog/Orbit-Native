import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { theme } from '../../constants/createPost/theme';

type Props = { visible: boolean; message: string };

/** Tiny, subtle pill that floats just above the footer. Pass `visible` from useTransientFlag. */
export function ComingSoonToast({ visible, message }: Props) {
  return (
    <View pointerEvents="none" style={styles.anchor}>
      {visible && (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={styles.pill}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, top: -38, alignItems: 'center' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(30,33,44,0.94)',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  text: { color: theme.colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
});
