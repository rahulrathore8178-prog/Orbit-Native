import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LucideIcon } from 'lucide-react-native';
import { COLORS, GlassPanel, NeoView } from '@/components/ui/neo';

export type SheetAction = {
    label: string;
    Icon: LucideIcon;
    onPress: () => void;
    destructive?: boolean;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    actions: SheetAction[];
};

const DANGER = '#f87171';

export default function ActionSheet({ visible, onClose, actions }: Props) {
    const insets = useSafeAreaInsets();

    // Let the sheet finish dismissing before an Alert or picker opens (iOS drops them otherwise).
    const run = (action: SheetAction) => {
        onClose();
        setTimeout(action.onPress, 280);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/60" onPress={onClose} accessibilityLabel="Close menu" />

            <Animated.View
                entering={SlideInDown.duration(280)}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
            >
                <View className="gap-3 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
                    <GlassPanel radius={28} style={{ padding: 8 }}>
                        {actions.map((action) => (
                            <Pressable key={action.label} onPress={() => run(action)} accessibilityRole="button">
                                {({ pressed }) => (
                                    <View className={`flex-row items-center gap-3.5 rounded-[20px] p-2 ${pressed ? 'bg-white/5' : ''}`}>
                                        <NeoView radius={14} pressed={pressed} style={{ width: 42, height: 42 }}>
                                            <action.Icon size={19} color={action.destructive ? DANGER : COLORS.text} strokeWidth={2} />
                                        </NeoView>
                                        <Text className={`text-base font-semibold ${action.destructive ? 'text-red-400' : 'text-white'}`}>
                                            {action.label}
                                        </Text>
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </GlassPanel>

                    <Pressable onPress={onClose} accessibilityRole="button">
                        {({ pressed }) => (
                            <NeoView radius={24} pressed={pressed} style={{ height: 52 }}>
                                <Text className="text-base font-semibold text-white">Cancel</Text>
                            </NeoView>
                        )}
                    </Pressable>
                </View>
            </Animated.View>
        </Modal>
    );
}