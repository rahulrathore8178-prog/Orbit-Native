import { GlassRow } from "@/components/ui/search/GlassRow";
import { ClockIcon, CloseIcon } from "@/components/ui/search/icons";
import { Reveal } from "./Reaveal";
import { colors, RAISED } from "@/components/ui/search/theme";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ROW } from "./constants";

type Props = {
    term: string;
    delay: number;
    onPick: (term: string) => void;
    onRemove: (term: string) => void;
};

export const HistoryRow = memo(function HistoryRow({ term, delay, onPick, onRemove }: Props) {
    return (
        <Reveal delay={delay} duration={600} y={18}>
            <GlassRow className={ROW}>
                <View className={`h-10 w-10 items-center justify-center rounded-xl ${RAISED}`}>
                    <ClockIcon size={18} color={colors.n400} />
                </View>
                <Pressable
                    onPress={() => onPick(term)}
                    accessibilityLabel={`Search “${term}”`}
                    className="min-w-0 flex-1"
                >
                    <Text numberOfLines={1} className="font-sora text-[15px] text-neutral-200">
                        {term}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => onRemove(term)}
                    accessibilityLabel={`Remove ${term} from history`}
                    hitSlop={8}
                    className="h-9 w-9 items-center justify-center rounded-full"
                >
                    <CloseIcon size={16} color={colors.n500} />
                </Pressable>
            </GlassRow>
        </Reveal>
    );
});