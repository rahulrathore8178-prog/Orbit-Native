import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type OrbitScrollCtx = {
    v: SharedValue<number>; // virtual scroll: [0..maxOuter] moves the page, beyond that moves the orbit
    maxOuter: SharedValue<number>;
    maxInner: SharedValue<number>;
    driving: SharedValue<boolean>;
    liveH: SharedValue<number>;
    topWin: SharedValue<number>;
    viewportH: number;
    collapseAt: number;
    setActive: (a: boolean) => void;
};

export const OrbitScrollContext = createContext<OrbitScrollCtx | null>(null);
export const useOrbitScroll = () => useContext(OrbitScrollContext);