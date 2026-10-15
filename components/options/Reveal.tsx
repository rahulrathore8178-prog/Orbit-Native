import React, { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

type Props = { delay?: number; className?: string; children: ReactNode };

/**
 * One soft entrance for a block of content.
 * The Animated.View only animates; layout classes go on the inner View, because
 * className is not applied to Reanimated components in this setup.
 */
export default function Reveal({ delay = 0, className, children }: Props) {
    return (
        <Animated.View entering={FadeInDown.delay(delay).duration(420).reduceMotion(ReduceMotion.System)}>
            <View className={className}>{children}</View>
        </Animated.View>
    );
}