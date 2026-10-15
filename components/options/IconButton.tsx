import React from 'react';
import { Pressable } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { COLORS, NeoView } from '@/components/ui/neo';

type Props = {
    Icon: LucideIcon;
    label: string;
    onPress: () => void;
    size?: number;
};

/** Round neumorphic icon button used in the top bar and the action row. */
export default function IconButton({ Icon, label, onPress, size = 18 }: Props) {
    return (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
            {({ pressed }) => (
                <NeoView radius={22} pressed={pressed} style={{ width: 44, height: 44 }}>
                    <Icon size={size} color={COLORS.text} strokeWidth={2} />
                </NeoView>
            )}
        </Pressable>
    );
}