import Ionicons from '@expo/vector-icons/Ionicons';
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

export type SeekFxHandle = { show: (side: 'left' | 'right', total: number) => void };

export const FlareSeekFx = forwardRef<SeekFxHandle>(function FlareSeekFx(_, ref) {
    const [side, setSide] = useState<'left' | 'right'>('right');
    const [total, setTotal] = useState(5);
    const op = useSharedValue(0);
    const ripple = useSharedValue(0);

    useImperativeHandle(ref, () => ({
        show: (s, t) => {
            setSide(s);
            setTotal(t);
            ripple.value = 0;
            ripple.value = withTiming(1, { duration: 480 });
            op.value = withSequence(withTiming(1, { duration: 90 }), withDelay(520, withTiming(0, { duration: 240 })));
        },
    }));

    const shape = useAnimatedStyle(() => ({
        opacity: op.value,
        transform: [{ scale: 0.92 + ripple.value * 0.08 }],
    }));
    const label = useAnimatedStyle(() => ({
        opacity: op.value,
        transform: [{ translateY: (1 - op.value) * 6 }],
    }));

    const left = side === 'left';

    return (
        <View pointerEvents="none" className="absolute inset-0">
            <Animated.View
                className={`absolute bottom-0 top-0 w-[40%] bg-white/15 ${left ? 'left-0 rounded-r-[999px]' : 'right-0 rounded-l-[999px]'}`}
                style={shape}
            />
            <Animated.View
                className={`absolute inset-y-0 w-[40%] items-center justify-center ${left ? 'left-0' : 'right-0'}`}
                style={label}
            >
                <Ionicons name={left ? 'play-back' : 'play-forward'} size={30} color="#fff" />
                <Text className="mt-1.5 text-[13px] font-semibold text-white">{total} seconds</Text>
            </Animated.View>
        </View>
    );
});