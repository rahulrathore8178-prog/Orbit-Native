import { Text, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

type Props = {
    progress: SharedValue<number>;
    scrubbing: SharedValue<number>;
    bottom: number;
    label: string; // e.g. "0:12"
    total: string; // e.g. "0:31"
};

export function FlareSeekBar({ progress, scrubbing, bottom, label, total }: Props) {
    const trackW = useSharedValue(0);

    const track = useAnimatedStyle(() => ({ height: interpolate(scrubbing.value, [0, 1], [2.5, 7]) }));
    const fill = useAnimatedStyle(() => ({ width: progress.value * trackW.value }));
    const thumb = useAnimatedStyle(() => ({
        opacity: scrubbing.value,
        transform: [{ translateX: progress.value * trackW.value - 7 }, { scale: 0.4 + scrubbing.value * 0.6 }],
    }));
    const time = useAnimatedStyle(() => ({
        opacity: scrubbing.value,
        transform: [{ translateY: (1 - scrubbing.value) * 8 }],
    }));

    return (
        <>
            <Animated.View pointerEvents="none" className="absolute inset-x-0 items-center" style={[{ bottom: bottom + 30 }, time]}>
                <View className="flex-row items-baseline rounded-full bg-black/40 px-4 py-1.5">
                    <Text className="text-[26px] font-bold text-white">{label}</Text>
                    <Text className="ml-1.5 text-[16px] font-semibold text-white/60">/ {total}</Text>
                </View>
            </Animated.View>

            <View pointerEvents="none" className="absolute inset-x-0 h-6 justify-center" style={{ bottom }}>
                <View className="mx-4 justify-center" onLayout={(e) => { trackW.value = e.nativeEvent.layout.width; }}>
                    <Animated.View className="overflow-hidden rounded-full bg-white/25" style={track}>
                        <Animated.View className="h-full rounded-full bg-white" style={fill} />
                    </Animated.View>
                    <Animated.View className="absolute left-0 h-3.5 w-3.5 rounded-full bg-white" style={thumb} />
                </View>
            </View>
        </>
    );
}