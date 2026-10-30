import { useCall } from '@/lib/calls/callProvider';
import { setMinimized } from '@/lib/calls/callUI';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Phone, PhoneOff, Video } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CallAvatar } from './CallAvatar';
import { CallButton } from './CallButton';

export function IncomingCallScreen() {
    const { state, acceptCall, rejectCall } = useCall();
    const insets = useSafeAreaInsets();
    const isVideo = state.callType === 'video';

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={['#010206', '#060f2e', '#010206']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />

            <View
                className="flex-1 items-center justify-between"
                style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 48 }}
            >
                <Animated.View entering={FadeInDown.duration(400)} className="items-center px-6">
                    <Text className="text-[12px] font-semibold uppercase tracking-[3px] text-sky-300/80">
                        {isVideo ? 'Incoming video call' : 'Incoming voice call'}
                    </Text>
                    <Text numberOfLines={1} className="mt-3 max-w-[90%] text-[32px] font-extrabold text-white">
                        {state.peer?.username}
                    </Text>
                    <Text className="mt-1.5 text-[14px] text-white/55">is calling you…</Text>
                </Animated.View>

                <Animated.View entering={ZoomIn.duration(450)}>
                    <CallAvatar uri={state.peer?.profilePic} name={state.peer?.username} pulsing />
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(400).delay(120)} className="w-full flex-row items-center justify-around px-12">
                    <CallButton Icon={PhoneOff} label="Decline" tone="danger" size={74} onPress={rejectCall} />
                    <CallButton Icon={isVideo ? Video : Phone} label="Accept" tone="accept" size={74} onPress={acceptCall} />
                </Animated.View>
            </View>

            <Pressable
                onPress={() => setMinimized(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Minimize"
                className="absolute h-10 w-10 items-center justify-center rounded-full bg-white/10"
                style={{ left: 16, top: insets.top + 12 }}
            >
                <ChevronDown size={22} color="#fff" strokeWidth={2.4} />
            </Pressable>
        </View>
    );
}