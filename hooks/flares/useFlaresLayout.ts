import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ACTIONS_GAP,
    HEADER_HEIGHT,
    TAB_BAR_HEIGHT,
    TAB_BAR_MIN_BOTTOM,
} from '@/constants/flares/contants';

const TabBarContext = createContext(true);

/** Wrap a flare pager. hasTabBar=false (viewer opened from Home) reclaims the tab bar's space. */
export function FlareLayoutProvider({ hasTabBar, children }: { hasTabBar: boolean; children: ReactNode }) {
    return createElement(TabBarContext.Provider, { value: hasTabBar }, children);
}

export function useFlareLayout() {
    const hasTabBar = useContext(TabBarContext);
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const barBottom = Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM);

    return {
        width,
        windowH: height,
        insets,
        topChrome: insets.top + HEADER_HEIGHT,
        actionsBottom: hasTabBar
            ? barBottom + TAB_BAR_HEIGHT + ACTIONS_GAP // sits above the floating bar
            : Math.max(insets.bottom, 12) + 14, // viewer: just above the screen edge
    };
}