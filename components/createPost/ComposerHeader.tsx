import { X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/createPost/theme';
import { NeoIconButton } from '../ui/createPost/NeoButton';
import { NeoSurface } from '../ui/createPost/NeoSurface';
import { Avatar } from './Avatar';

type Props = {
  username?: string;
  profilePic?: string;
  subtitle: string;
  onClose: () => void;
};

export function ComposerHeader({ username, profilePic, subtitle, onClose }: Props) {
  return (
    <View style={styles.row}>
      <NeoSurface radius={26} style={{ width: 52, height: 52 }}>
        <Avatar uri={profilePic} name={username} size={42} />
      </NeoSurface>

      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.name}>
          {username || 'You'}
        </Text>
        <Text numberOfLines={1} style={styles.sub}>
          {subtitle}
        </Text>
      </View>

      <NeoIconButton Icon={X} label="Close composer" onPress={onClose} size={40} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  text: { flex: 1 },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  sub: { color: theme.colors.textDim, fontSize: 12.5, marginTop: 2 },
});
