import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

/** Soft black fade at the top/bottom edge of the scroll area. */
export function EdgeFade({ edge }: { edge: "top" | "bottom" }) {
    const top = edge === "top";
    return (
        <View pointerEvents="none" className={`absolute inset-x-0 h-4 ${top ? "top-0" : "bottom-0"}`}>
            <LinearGradient
                colors={top ? ["rgba(0,0,0,0.8)", "transparent"] : ["transparent", "rgba(0,0,0,0.8)"]}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}