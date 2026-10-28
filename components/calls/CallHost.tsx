import { useCall } from '@/lib/calls/callProvider';
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ActiveCallScreen } from './ActiveCallScreen';
import { IncomingCallScreen } from './IncomingCallScreen';

/**
 * Full-screen call UI. Mounted once in app/_layout.tsx, above the navigator, inside <CallProvider>,
 * so an incoming call shows up on top of whatever screen the user is on.
 *
 *   idle      nothing rendered
 *   incoming  Accept / Decline
 *   others    outgoing, connecting, active, ended -> ActiveCallScreen
 */
export function CallHost() {
    const { state } = useCall();
    const visible = state.phase !== 'idle';

    // Android back must not navigate the screens hidden behind a live call.
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="auto">
            {state.phase === 'incoming' ? <IncomingCallScreen /> : <ActiveCallScreen />}
        </View>
    );
}
