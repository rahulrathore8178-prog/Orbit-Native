import * as Haptics from 'expo-haptics';
import { LucideIcon } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

type Tone = 'glass' | 'active' | 'danger' | 'accept';

// Full class names (not built dynamically) so NativeWind can see them.
const TONE: Record<Tone, string> = {
    glass: 'bg-white/10 border-white/15',
    active: 'bg-white border-white',
    danger: 'bg-red-500 border-red-300/40',
    accept: 'bg-emerald-500 border-emerald-300/40',
};

type Props = {
    Icon: LucideIcon;
    label: string;
    onPress: () => void;
    tone?: Tone;
    size?: number;
    disabled?: boolean;
};

export const CallButton = memo(function CallButton({ Icon, label, onPress, tone = 'glass', size = 64, disabled }: Props) {
    return (
        <View className="items-center">
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={label}
                className={`items-center justify-center rounded-full border active:scale-90 ${TONE[tone]} ${disabled ? 'opacity-40' : ''}`}
                style={{ width: size, height: size }}
            >
                <Icon size={Math.round(size * 0.4)} color={tone === 'active' ? '#0a0a0a' : '#ffffff'} strokeWidth={2.2} />
            </Pressable>
            <Text className="mt-2 text-[12px] font-medium text-white/70">{label}</Text>
        </View>
    );
});