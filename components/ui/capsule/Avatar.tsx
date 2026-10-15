import React, { memo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/capsule/constants';

function AvatarBase({ uri, size = 36 }: { uri?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="person" size={size * 0.5} color={COLORS.dim} />
      )}
    </View>
  );
}

export const Avatar = memo(AvatarBase);
