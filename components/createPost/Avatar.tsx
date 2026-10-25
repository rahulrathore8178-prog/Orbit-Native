import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { resolveUrl } from '../../constants/createPost/external';
import { theme } from '../../constants/createPost/theme';

type Props = { uri?: string; name?: string; size?: number };

/** Profile photo with a graceful fallback (initial letter) if there is no photo or it fails to load. */
export function Avatar({ uri, name, size = 40 }: Props) {
  const resolved = resolveUrl(uri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [resolved]);

  if (resolved && !failed) {
    return (
      <Image
        source={{ uri: resolved }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.neoPressed }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: size * 0.42, fontWeight: '800' }}>
        {(name?.trim()?.[0] ?? 'Y').toUpperCase()}
      </Text>
    </View>
  );
}
