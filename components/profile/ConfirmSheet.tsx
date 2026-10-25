import { BlurView } from 'expo-blur';
import { Trash2, type LucideIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, NeoView } from '../ui/neo';

type Props = {
    visible: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    Icon?: LucideIcon;
    onConfirm: () => void;
    onCancel: () => void;
};

/** Bottom sheet confirm: glass blur backdrop + neomorphic icon and buttons. */
export default function ConfirmSheet({
    visible,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false,
    Icon = Trash2,
    onConfirm,
    onCancel,
}: Props) {
    const insets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(visible);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(progress, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(progress, {
                toValue: 0,
                duration: 200,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, progress]);

    if (!mounted) return null;

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });
    const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
    const accent = destructive ? '#f87171' : COLORS.text;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
            <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
            />
            <Pressable onPress={onCancel} className="absolute inset-0" accessibilityLabel="Dismiss" />

            <View pointerEvents="box-none" className="flex-1 justify-end">
                <Animated.View style={{ transform: [{ translateY }] }}>
                    <View className="overflow-hidden rounded-t-[32px] border border-b-0 border-white/15">
                        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                        <View pointerEvents="none" className="absolute inset-0 bg-[rgba(10,12,18,0.9)]" />

                        <View className="items-center pb-2 pt-2.5">
                            <View className="h-[5px] w-11 rounded-full bg-white/20" />
                        </View>

                        <View className="items-center px-6 pb-5 pt-3">
                            <NeoView radius={28} style={{ width: 56, height: 56 }}>
                                <Icon size={24} color={accent} />
                            </NeoView>
                            <Text className="mt-4 text-center text-xl font-extrabold text-white">{title}</Text>
                            {message ? (
                                <Text className="mt-1.5 text-center text-sm leading-5 text-white/60">{message}</Text>
                            ) : null}
                        </View>

                        <View className="flex-row gap-3 px-5" style={{ paddingBottom: insets.bottom + 16 }}>
                            <Pressable onPress={onCancel} className="flex-1" accessibilityRole="button">
                                {({ pressed }) => (
                                    <NeoView radius={18} pressed={pressed} contentStyle={{ paddingVertical: 14, alignItems: 'center' }}>
                                        <Text className="text-[15px] font-bold text-white">{cancelText}</Text>
                                    </NeoView>
                                )}
                            </Pressable>

                            <Pressable onPress={onConfirm} className="flex-1" accessibilityRole="button">
                                {({ pressed }) => (
                                    <NeoView radius={18} pressed={pressed} contentStyle={{ paddingVertical: 14, alignItems: 'center' }}>
                                        <Text className="text-[15px] font-bold" style={{ color: accent }}>
                                            {confirmText}
                                        </Text>
                                    </NeoView>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}