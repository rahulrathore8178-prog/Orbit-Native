import { Text } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

export function ErrorBanner({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <Animated.View
            entering={FadeInDown.duration(250)}
            exiting={FadeOutUp.duration(200)}
            accessibilityRole="alert"
            className="mb-2 max-w-2xl self-center rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-2.5"
        >
            <Text className="font-sora text-[13px] text-red-200">{message}</Text>
        </Animated.View>
    );
}