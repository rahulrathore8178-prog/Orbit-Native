import React, { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';

type Props = Omit<PressableProps, 'children'> & {
    children: ReactNode;
    className?: string;
    scaleTo?: number;
};

export function PressableScale({ children, scaleTo = 0.88, onPressIn, onPressOut, ...rest }: Props) {
    const scale = useRef(new Animated.Value(1)).current;
    const to = (v: number) =>
        Animated.spring(scale, { toValue: v, useNativeDriver: true, damping: 15, stiffness: 320, mass: 0.6 }).start();

    return (
        <Pressable
            hitSlop={10}
            accessibilityRole="button"
            {...rest}
            onPressIn={(e) => {
                to(scaleTo);
                onPressIn?.(e);
            }}
            onPressOut={(e) => {
                to(1);
                onPressOut?.(e);
            }}
        >
            <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
        </Pressable>
    );
}