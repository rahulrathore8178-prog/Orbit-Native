import { Image } from 'expo-image';
import React, { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

function Ring({ size, delay, active }: { size: number; delay: number; active: boolean }) {
    const p = useSharedValue(0);

    useEffect(() => {
        if (active) {
            p.value = 0;
            p.value = withDelay(
                delay,
                withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false)
            );
        } else {
            cancelAnimation(p);
            p.value = 0;
        }
    }, [active, delay, p]);

    const style = useAnimatedStyle(() => ({
        opacity: (1 - p.value) * 0.35,
        transform: [{ scale: 1 + p.value * 0.9 }],
    }));

    return (
        <Animated.View
            pointerEvents="none"
            className="absolute rounded-full border border-sky-400/60 bg-sky-400/10"
            style={[{ width: size, height: size }, style]}
        />
    );
}

type Props = { uri?: string; name?: string; size?: number; pulsing?: boolean };

export const CallAvatar = memo(function CallAvatar({ uri, name, size = 148, pulsing = false }: Props) {
    const initial = (name?.trim()?.[0] ?? '?').toUpperCase();

    return (
        <View className="items-center justify-center" style={{ width: size * 2, height: size * 2 }}>
            <Ring size={size} delay={0} active={pulsing} />
            <Ring size={size} delay={1200} active={pulsing} />
            <View
                className="items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-neutral-900"
                style={{ width: size, height: size }}
            >
                {uri ? (
                    <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
                ) : (
                    <Text className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
                        {initial}
                    </Text>
                )}
            </View>
        </View>
    );
});