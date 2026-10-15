import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export const COLORS = {
    surface: '#12151B',
    text: '#E8EAF0',
    muted: '#7C8494',
    accent: '#1D9BF0',
    glassBorder: 'rgba(255,255,255,0.12)',
};

type NeoViewProps = {
    radius?: number;
    pressed?: boolean; // true = inset (pushed in), false = raised
    accent?: boolean;
    style?: StyleProp<ViewStyle>;        // size / margins go here
    contentStyle?: StyleProp<ViewStyle>; // padding / layout of children
    children?: React.ReactNode;
};

/** Neumorphic surface: dark shadow bottom-right + light shadow top-left. */
export function NeoView({
    radius = 16,
    pressed = false,
    accent = false,
    style,
    contentStyle,
    children,
}: NeoViewProps) {
    const colors: [string, string] = accent
        ? ['#2FAEFF', '#1479C9']
        : pressed
            ? ['#0C0F14', '#1A1E26']
            : ['#1F232C', '#0F1217'];

    return (
        <View
            style={[
                {
                    borderRadius: radius,
                    backgroundColor: COLORS.surface,
                    shadowColor: '#000',
                    shadowOffset: { width: 5, height: 5 },
                    shadowOpacity: pressed ? 0 : 0.85,
                    shadowRadius: 8,
                    elevation: pressed ? 0 : 7,
                },
                style,
            ]}
        >
            <View
                style={{
                    flexGrow: 1,
                    borderRadius: radius,
                    backgroundColor: COLORS.surface,
                    shadowColor: '#fff',
                    shadowOffset: { width: -3, height: -3 },
                    shadowOpacity: pressed ? 0 : 0.07,
                    shadowRadius: 6,
                }}
            >
                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        {
                            flexGrow: 1,
                            borderRadius: radius,
                            borderWidth: 1,
                            borderColor: pressed
                                ? 'rgba(0,0,0,0.55)'
                                : accent
                                    ? 'rgba(255,255,255,0.25)'
                                    : 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        contentStyle,
                    ]}
                >
                    {children}
                </LinearGradient>
            </View>
        </View>
    );
}

type GlassPanelProps = {
    radius?: number;
    blur?: boolean; // real backdrop blur (use on the outermost panel)
    intensity?: number;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
};

/** Glassmorphic surface: frosted fill + sheen + hairline border. */
export function GlassPanel({
    radius = 24,
    blur = false,
    intensity = 45,
    style,
    children,
}: GlassPanelProps) {
    return (
        <View
            style={[
                {
                    borderRadius: radius,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: COLORS.glassBorder,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                },
                style,
            ]}
        >
            {blur && (
                <BlurView
                    intensity={intensity}
                    tint="dark"
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFill}
                />
            )}
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}