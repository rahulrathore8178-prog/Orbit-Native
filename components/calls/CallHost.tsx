import { useCall } from '@/lib/calls/callProvider';
import { setMinimized, useMinimized } from '@/lib/calls/callUI';
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ActiveCallScreen } from './ActiveCallScreen';
import { CallPill } from './CallPill';
import { IncomingCallScreen } from './IncomingCallScreen';

export function CallHost() {
    const { state } = useCall();
    const minimized = useMinimized();
    const visible = state.phase !== 'idle';

    // fresh call (or call over) -> always start full screen
    useEffect(() => {
        if (state.phase === 'idle' || state.phase === 'incoming') setMinimized(false);
    }, [state.phase]);

    // Android back: minimize the call instead of being stuck; once minimized, back behaves normally
    useEffect(() => {
        if (!visible || minimized) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setMinimized(true);
            return true;
        });
        return () => sub.remove();
    }, [visible, minimized]);

    if (!visible) return null;
    if (minimized) return <CallPill />;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="auto">
            {state.phase === 'incoming' ? <IncomingCallScreen /> : <ActiveCallScreen />}
        </View>
    );
}