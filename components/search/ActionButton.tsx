import { RAISED } from "@/components/ui/search/theme";
import { ReactNode } from "react";
import { Pressable } from "react-native";

type Props = { label: string; onPress: () => void; plain?: boolean; children: ReactNode };

/** Round 40px icon button. `plain` = subtle/secondary look. */
export function ActionButton({ label, onPress, plain = false, children }: Props) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`h-10 w-10 items-center justify-center rounded-full active:scale-90 ${plain ? "border border-white/10 bg-white/5" : RAISED
                }`}
        >
            {children}
        </Pressable>
    );
}