import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import FlaresScreen from '@/components/flares/FlaresScreen';
import { FlareTransition } from '@/components/flares/FlareTransition';

export default function FlareViewerRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: false,
                    presentation: 'transparentModal', // Home stays rendered underneath
                    animation: 'none', // FlareTransition does the animating
                    gestureEnabled: false,
                    contentStyle: { backgroundColor: 'transparent' },
                }}
            />
            <FlareTransition>
                {(close) => <FlaresScreen startPostId={id} onBack={close} />}
            </FlareTransition>
        </>
    );
}