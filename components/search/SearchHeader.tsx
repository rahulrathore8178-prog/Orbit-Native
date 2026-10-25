import { OrbitMark } from "@/components/ui/search/icons";
import { Reveal } from "./Reaveal";
import { RAISED } from "@/components/ui/search/theme";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTENT } from "./constants";

export function SearchHeader() {
    const insets = useSafeAreaInsets();

    return (
        <Reveal
            delay={350}
            duration={900}
            y={-24}
            className={CONTENT}
            style={{ paddingTop: Math.max(0, insets.top) }}
        >
            <View className="flex-row items-center gap-3">
                <View className={`h-11 w-11 items-center justify-center rounded-2xl ${RAISED}`}>
                    <OrbitMark />
                </View>
                <View>
                    <Text className="font-sora-semibold text-lg tracking-tight text-neutral-100">Orb8</Text>
                    <Text className="font-sora-light text-xs text-neutral-500">Search</Text>
                </View>
            </View>
        </Reveal>
    );
}