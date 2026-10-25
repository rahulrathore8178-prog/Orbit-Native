import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { theme } from '../../constants/createPost/theme';
import { NeoButton } from '../ui/createPost/NeoButton';

type Props = { onPress: () => void; hasDraft: boolean; bottomOffset: number };

/** Floating "+" that opens the composer. A small dot shows there is an unsent draft. */
export function ComposerFab({ onPress, hasDraft, bottomOffset }: Props) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom: bottomOffset }}>
      <NeoButton onPress={onPress} label="Create post" radius={22} style={{ width: 58, height: 58 }}>
        <Plus size={26} color={theme.colors.text} strokeWidth={2.4} />
        {hasDraft && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: theme.colors.accent,
            }}
          />
        )}
      </NeoButton>
    </View>
  );
}
