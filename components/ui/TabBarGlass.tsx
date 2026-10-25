import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

export function TabBarGlass() {
    const radius = 999;

    if (Platform.OS === 'android') {
        return (
            <View
                style={[StyleSheet.absoluteFill, {
                    borderRadius: radius,
                    backgroundColor: 'rgba(24,24,28,0.88)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(255,255,255,0.18)',
                }]}
            />
        );
    }

    return (
        <BlurView
            intensity={40}
            tint="dark"
            style={[StyleSheet.absoluteFill, {
                borderRadius: radius,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.18)',
                backgroundColor: 'rgba(255,255,255,0.06)',
            }]}
        />
    );
}