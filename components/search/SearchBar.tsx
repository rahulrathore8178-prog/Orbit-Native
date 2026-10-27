// import { CloseIcon, SearchIcon } from "@/components/ui/Icons";
import { Reveal } from "./Reaveal";
import { colors, RAISED } from "@/components/ui/search/theme";
import { BlurView } from "expo-blur";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Easing } from "react-native-reanimated";
import { CONTENT } from "./constants";
import { SearchIcon, X } from "lucide-react-native";

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit: () => void;
};

const IS_IOS = Platform.OS === "ios";

export function SearchBar({ value, onChangeText, onSubmit }: Props) {
    // local state: focusing the input only re-renders the bar, not the whole screen
    const [focused, setFocused] = useState(false);

    return (
        <Reveal
            delay={900}
            duration={1000}
            y={110}
            easing={Easing.out(Easing.back(1.5))}
            className={`${CONTENT} pt-2`}
        >
            <View
                className={`overflow-hidden rounded-[30px] border p-2 ${IS_IOS ? "bg-white/[0.045]" : "bg-neutral-950/90"} ${focused ? "border-white/25" : "border-white/10"
                    }`}
            >
                {/* blur is only used on iOS: a live blur under a moving view is very expensive on Android */}
                {IS_IOS && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}

                <View className="flex-row items-center gap-2 rounded-3xl border border-white/[0.04] bg-[#050505] py-1.5 pl-4 pr-1.5">
                    <SearchIcon size={20} color={colors.n400} />
                    <TextInput
                        value={value}
                        onChangeText={onChangeText}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onSubmitEditing={onSubmit}
                        placeholder="Search anything on orbit"
                        placeholderTextColor={colors.n600}
                        accessibilityLabel="Search anything on orbit"
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        className="min-w-0 flex-1 py-2.5 font-sora text-[15px] text-neutral-100"
                    />
                    {value.length > 0 && (
                        <Pressable
                            onPress={() => onChangeText("")}
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                            hitSlop={8}
                            className="h-8 w-8 items-center justify-center rounded-full"
                        >
                            <X size={16} color={colors.n400} />
                        </Pressable>
                    )}
                    <Pressable
                        onPress={onSubmit}
                        accessibilityRole="button"
                        accessibilityLabel="Search"
                        className={`h-11 w-11 items-center justify-center rounded-full active:scale-95 ${RAISED}`}
                    >
                        <SearchIcon size={20} color={colors.n400} />
                    </Pressable>
                </View>
            </View>
        </Reveal>
    );
}