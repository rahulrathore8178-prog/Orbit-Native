import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

type Props = {
    size?: number;
    color?: string;
    /** orbit ring thickness, in the 24-unit viewBox */
    strokeWidth?: number;
};

export function FlareIcon({ size = 30, color = '#fff', strokeWidth = 1.4 }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* orbit ring + satellite, tilted toward the upper right */}
            <G rotation={-28} origin="12, 12">
                <Ellipse cx={12} cy={12} rx={10} ry={3.7} stroke={color} strokeWidth={strokeWidth} opacity={0.75} />
                <Circle cx={21.4} cy={10.8} r={1.6} fill={color} />
            </G>
            {/* four-point sparkle, concave sides for a sharp, premium look */}
            {/* four-point sparkle, slightly fuller curves and a touch more reach */}
            <Path
                d="M12 3.8 C12.75 8.9 15.1 11.25 20.2 12 C15.1 12.75 12.75 15.1 12 20.2 C11.25 15.1 8.9 12.75 3.8 12 C8.9 11.25 11.25 8.9 12 3.8 Z"
                fill={color}
                stroke={color}
                strokeWidth={0.4}
                strokeLinejoin="round"
            />
        </Svg>
    );
}