import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, NeoView } from '../sideDrawer/neo';

export default function OrbitIcon({ size = 48 }: { size?: number }) {
    const spin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 3800,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [spin]);

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <NeoView radius={size / 2} style={{ width: size, height: size }}>
            {/* static core */}
            <View
                style={{
                    width: size * 0.16,
                    height: size * 0.16,
                    borderRadius: size * 0.08,
                    backgroundColor: COLORS.text,
                }}
            />
            {/* rotating orbit + planet */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    transform: [{ rotate }],
                }}
            >
                <Svg width={size} height={size} viewBox="0 0 48 48">
                    <Circle
                        cx={24}
                        cy={24}
                        r={15}
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth={1.2}
                        strokeDasharray="2 3"
                        fill="none"
                    />
                    <Circle cx={24} cy={9} r={5} fill={COLORS.accent} opacity={0.25} />
                    <Circle cx={24} cy={9} r={3} fill={COLORS.accent} />
                </Svg>
            </Animated.View>
        </NeoView>
    );
}