import { GlassRow } from "@/components/ui/search/GlassRow";
import { Reveal } from "./Reaveal";
import { Text } from "react-native";

type Props = { title: string; subtitle: string; delay?: number };

export function EmptyState({ title, subtitle, delay = 0 }: Props) {
    return (
        <Reveal delay={delay} duration={500} y={12}>
            <GlassRow className="mt-6 rounded-3xl px-6 py-10">
                <Text className="text-center font-sora text-base text-neutral-200">{title}</Text>
                <Text className="mt-1.5 text-center font-sora-light text-sm text-neutral-500">{subtitle}</Text>
            </GlassRow>
        </Reveal>
    );
}