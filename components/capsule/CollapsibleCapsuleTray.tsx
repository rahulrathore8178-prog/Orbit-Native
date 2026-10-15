import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '../ui/capsule/GlassPanel';

interface Props {
  height: number; // from useTrayHeight()
  trayStyle: StyleProp<ViewStyle>; // from useCollapsibleTray()
  children: React.ReactNode;
}

// Glass panel pinned to the top; slides away / back via the scroll hook.
export function CollapsibleCapsuleTray({ height, trayStyle, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, height, zIndex: 10 }, trayStyle]}
    >
      <GlassPanel edge="bottom" intensity={55} style={{ flex: 1, paddingTop: insets.top + 12 }}>
        {children}
      </GlassPanel>
    </Animated.View>
  );
}
