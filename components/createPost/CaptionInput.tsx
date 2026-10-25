import { Text, TextInput } from 'react-native';
import { MAX_CAPTION } from '../../constants/createPost/external';
import { theme } from '../../constants/createPost/theme';
import { GlassCard } from '../ui/createPost/GlassCard';

type Props = { value: string; onChange: (v: string) => void; editable?: boolean };

export function CaptionInput({ value, onChange, editable = true }: Props) {
  const nearLimit = value.length > MAX_CAPTION * 0.9;

  return (
    <GlassCard radius={22} style={{ padding: 16 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder="Add a caption and #hashtags"
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.accent}
        maxLength={MAX_CAPTION}
        multiline
        style={{
          color: theme.colors.text,
          fontSize: 16,
          lineHeight: 24,
          minHeight: 104,
          textAlignVertical: 'top',
          padding: 0,
        }}
      />
      <Text
        style={{
          color: nearLimit ? theme.colors.accent : theme.colors.muted,
          fontSize: 11.5,
          marginTop: 10,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value.length}/{MAX_CAPTION}
      </Text>
    </GlassCard>
  );
}
