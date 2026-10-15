import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

// Android cannot cheaply blur a view that sits over scrolling content, so it gets a
// near-solid dark fill instead. iOS and web get the real frosted glass.
const REAL_BLUR = Platform.OS !== 'android';

export default function TabBarGlass() {
    return (
        <View style={styles.shell}>
            {REAL_BLUR && <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />}
            <View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: REAL_BLUR ? 'rgba(255,255,255,0.05)' : 'rgba(20,20,23,0.92)' },
                ]}
            />
            <View pointerEvents="none" style={styles.highlight} />
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        flex: 1,
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    // thin light edge along the top, like light catching the glass
    highlight: {
        position: 'absolute',
        top: 0,
        left: 28,
        right: 28,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
});