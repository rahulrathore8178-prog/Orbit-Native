import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, View } from 'react-native';
import { PressableScale } from './PressableScale';

type Props = {
    paused: boolean;
    muted: boolean;
    onTogglePause: () => void;
    onToggleMute: () => void;
};

const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
};

export function FlareControls({ paused, muted, onTogglePause, onToggleMute }: Props) {
    return (
        <View className="mt-3 h-10 flex-row items-center justify-between px-5">
            <PressableScale onPress={() => { tap(); onTogglePause(); }} accessibilityLabel={paused ? 'Play' : 'Pause'}>
                <Ionicons name={paused ? 'play' : 'pause'} size={26} color="#fff" />
            </PressableScale>
            <PressableScale onPress={() => { tap(); onToggleMute(); }} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
            </PressableScale>
        </View>
    );
}