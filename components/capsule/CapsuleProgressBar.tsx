import React, { memo } from 'react';
import { View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

interface Props {
  count: number;
  activeIndex: number;
  progress: SharedValue<number>;
}

function Segment({
  index,
  activeIndex,
  progress,
}: {
  index: number;
  activeIndex: number;
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => {
    const v = index < activeIndex ? 1 : index === activeIndex ? progress.value : 0;
    return { width: `${Math.min(Math.max(v, 0), 1) * 100}%` };
  });
  return (
    <View
      style={{
        flex: 1,
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.22)',
      }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: '#FFFFFF' }, fill]} />
    </View>
  );
}

function CapsuleProgressBarBase({ count, activeIndex, progress }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} index={i} activeIndex={activeIndex} progress={progress} />
      ))}
    </View>
  );
}

export const CapsuleProgressBar = memo(CapsuleProgressBarBase);
