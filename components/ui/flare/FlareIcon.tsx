import React, { useId } from 'react';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';

type Props = {
    size?: number;
    color?: string;
    /** orbit ring thickness, in the 24-unit viewBox */
    strokeWidth?: number;
    /** size of the cut-out gap where the ring passes behind/in front of the star */
    gap?: number;
};

const STAR_PATH =
    'M12 3.8 C12.75 8.9 15.1 11.25 20.2 12 C15.1 12.75 12.75 15.1 12 20.2 C11.25 15.1 8.9 12.75 3.8 12 C8.9 11.25 11.25 8.9 12 3.8 Z';

// Same ellipse (rx=10, ry=3.7) split into two halves
const RING_BACK = 'M2 12 A10 3.7 0 0 1 22 12'; // passes over the top
const RING_FRONT = 'M2 12 A10 3.7 0 0 0 22 12'; // passes under the bottom

export function FlareIcon({ size = 30, color = '#fff', strokeWidth = 1.4, gap = 1.2 }: Props) {
    // useId can contain ':' which some SVG renderers dislike
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const backMaskId = `ringBack${uid}`;
    const starMaskId = `starCut${uid}`;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
                {/* hides the back half of the ring wherever the star is (plus a small gap) */}
                <Mask id={backMaskId} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
                    <Rect x={0} y={0} width={24} height={24} fill="#fff" />
                    <Path d={STAR_PATH} fill="#000" stroke="#000" strokeWidth={gap * 1.4} strokeLinejoin="round" />
                </Mask>

                {/* cuts a thin gap in the star where the front half of the ring crosses it */}
                <Mask id={starMaskId} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
                    <Rect x={0} y={0} width={24} height={24} fill="#fff" />
                    <G rotation={-28} origin="12, 12">
                        <Path d={RING_FRONT} stroke="#000" strokeWidth={strokeWidth + gap * 2} fill="none" />
                    </G>
                </Mask>
            </Defs>

            {/* 1. back half of the ring + satellite (hidden behind the star) */}
            <G rotation={-28} origin="12, 12" mask={`url(#${backMaskId})`}>
                <Path d={RING_BACK} stroke={color} strokeWidth={strokeWidth} opacity={0.75} fill="none" />
            </G>

            {/* satellite sits far from the star, so it needs no mask */}
            <G rotation={-28} origin="12, 12">
                <Circle cx={21.4} cy={10.8} r={1.6} fill={color} />
            </G>

            {/* 2. the star, with a gap where the front ring crosses */}
            <G mask={`url(#${starMaskId})`}>
                <Path d={STAR_PATH} fill={color} stroke={color} strokeWidth={0.4} strokeLinejoin="round" />
            </G>

            {/* 3. front half of the ring, drawn on top of the star */}
            <G rotation={-28} origin="12, 12">
                <Path d={RING_FRONT} stroke={color} strokeWidth={strokeWidth} opacity={0.75} fill="none" />
            </G>
        </Svg>
    );
}