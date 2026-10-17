import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { white } from "./theme";

/** Frosted-looking surface: soft diagonal gradient + hairline border. */
export function GlassRow({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <View className={`overflow-hidden border border-white/10 ${className}`}>
            <LinearGradient
                pointerEvents="none"
                colors={[white(0.1), white(0.03)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}