import { GlassRow } from "@/components/ui/search/GlassRow";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { ROW } from "./constants";

export function SkeletonRow() {
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={pulse}>
            <GlassRow className={ROW}>
                <View className="h-11 w-11 rounded-xl bg-white/[0.07]" />
                <View className="h-3.5 w-32 rounded-[7px] bg-white/[0.08]" />
                <View className="ml-auto h-10 w-10 rounded-full bg-white/[0.07]" />
            </GlassRow>
        </Animated.View>
    );
}