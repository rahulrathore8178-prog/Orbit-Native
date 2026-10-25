import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
    /** ref of the <BlurTargetView> that wraps the content behind the glass (required for blur on Android) */
    blurTarget: RefObject<View | null>;
    intensity?: number;
    className?: string;
    children?: ReactNode;
};

/**
 * Dark frosted glass: real blur + dark scrim + faint gloss + hairline edge.
 * BlurView and LinearGradient are third-party, so they take `style`; layout/colour use className.
 *
 * Too bright?  raise the scrim (bg-black/40 -> bg-black/55) or lower the gradient alphas.
 * Too dark?    lower the scrim (bg-black/40 -> bg-black/25).
 */
export default function FrostedGlass({ blurTarget, intensity , className = '', children }: Props) {
    return (
        <View className={`overflow-hidden bg-black border-white/10 ${className}`}>
            <BlurView
                blurTarget={blurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={intensity}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
            {/* dark scrim: stops bright posts behind the glass from lighting it up */}
            <View pointerEvents="none" className="absolute inset-0 bg-black/85" />
            {/* gloss: just a hint of light along the top-left edge */}
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}