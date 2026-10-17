import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import Reanimated, {
    Extrapolation,
    SharedValue,
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedReaction,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
} from 'react-native-reanimated';

/* ------------------------------------------------------------------ */
/*  useSwipeTabs: the engine                                           */
/* ------------------------------------------------------------------ */

type Options = {
    /** Number of pages / tabs. */
    count: number;
    /** Page to start on. Default 0. */
    initialIndex?: number;
    /** Fires once a page settles (tap or swipe). */
    onIndexChange?: (index: number) => void;
};

/**
 * Drives a swipeable pager. Everything animated hangs off `progress`:
 * a UI-thread shared value that is 0 on the first page, 1 on the second, etc.
 * and fractional while the user is mid-swipe.
 */
export function useSwipeTabs({ count, initialIndex = 0, onIndexChange }: Options) {
    const scrollRef = useRef<Reanimated.ScrollView>(null);
    const [index, setIndex] = useState(initialIndex);
    const [size, setSize] = useState({ w: 0, h: 0 });

    const scrollX = useSharedValue(0);
    const pageW = useSharedValue(1);

    const progress = useDerivedValue(() => (pageW.value > 0 ? scrollX.value / pageW.value : 0));

    const callbackRef = useRef(onIndexChange);
    useEffect(() => {
        callbackRef.current = onIndexChange;
    });

    const handleIndex = useCallback((i: number) => {
        setIndex(i);
        callbackRef.current?.(i);
    }, []);

    const onScroll = useAnimatedScrollHandler((e) => {
        scrollX.value = e.contentOffset.x;
    });

    // report the page once it settles (rounded, so it flips at the halfway point)
    useAnimatedReaction(
        () => Math.round(progress.value),
        (cur, prev) => {
            if (prev !== null && cur !== prev) runOnJS(handleIndex)(cur);
        }
    );

    const onLayout = useCallback(
        (e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            pageW.value = width;
            setSize({ w: width, h: height });
        },
        [pageW]
    );

    // (re)position on first layout and when the width changes (e.g. rotation)
    useEffect(() => {
        if (size.w > 0) {
            scrollRef.current?.scrollTo({ x: index * size.w, y: 0, animated: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size.w]);

    const goTo = useCallback(
        (i: number, animated = true) => {
            const clamped = Math.max(0, Math.min(count - 1, i));
            scrollRef.current?.scrollTo({ x: clamped * size.w, y: 0, animated });
        },
        [count, size.w]
    );

    return { index, progress, goTo, scrollRef, onScroll, onLayout, size, count };
}

export type SwipeTabs = ReturnType<typeof useSwipeTabs>;

/* ------------------------------------------------------------------ */
/*  SwipePager: renders the pages                                      */
/* ------------------------------------------------------------------ */

type PagerProps = {
    swipe: SwipeTabs;
    /** One child per page, in tab order. */
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Fade neighbouring pages while swiping. Default true. */
    fade?: boolean;
    /** Scale neighbouring pages while swiping. Default true. */
    scale?: boolean;
    minOpacity?: number;
    minScale?: number;
    scrollEnabled?: boolean;
};

function SwipePage({
    i,
    progress,
    width,
    height,
    fade,
    scale,
    minOpacity,
    minScale,
    children,
}: {
    i: number;
    progress: SharedValue<number>;
    width: number;
    height: number;
    fade: boolean;
    scale: boolean;
    minOpacity: number;
    minScale: number;
    children: React.ReactNode;
}) {
    const animated = useAnimatedStyle(() => {
        const range = [i - 1, i, i + 1];
        return {
            opacity: fade
                ? interpolate(progress.value, range, [minOpacity, 1, minOpacity], Extrapolation.CLAMP)
                : 1,
            transform: [
                {
                    scale: scale
                        ? interpolate(progress.value, range, [minScale, 1, minScale], Extrapolation.CLAMP)
                        : 1,
                },
            ],
        };
    });

    return (
        <Reanimated.View style={[{ width, height }, animated]}>
            {children}
        </Reanimated.View>
    );
}

export function SwipePager({
    swipe,
    children,
    style,
    fade = true,
    scale = true,
    minOpacity = 0.15,
    minScale = 0.94,
    scrollEnabled = true,
}: PagerProps) {
    const pages = React.Children.toArray(children);
    // pull out only what's needed so no ref object is passed down to children
    const { progress, size, scrollRef, onScroll, onLayout } = swipe;

    return (
        <View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={onLayout}>
            {size.w > 0 && (
                <Reanimated.ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    overScrollMode="never"
                    nestedScrollEnabled
                    decelerationRate="fast"
                    scrollEnabled={scrollEnabled}
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={onScroll}
                >
                    {pages.map((child, i) => (
                        <SwipePage
                            key={(child as any)?.key ?? i}
                            i={i}
                            progress={progress}
                            width={size.w}
                            height={size.h}
                            fade={fade}
                            scale={scale}
                            minOpacity={minOpacity}
                            minScale={minScale}
                        >
                            {child}
                        </SwipePage>
                    ))}
                </Reanimated.ScrollView>
            )}
        </View>
    );
}

/* ------------------------------------------------------------------ */
/*  Tab bar helpers: styles that follow `progress`                     */
/* ------------------------------------------------------------------ */

/** Style for the sliding pill. `tabWidth` is the width of ONE tab. */
export function useTabIndicatorStyle(progress: SharedValue<number>, tabWidth: number, stretch = 0.14) {
    return useAnimatedStyle(() => {
        const dist = Math.abs(progress.value - Math.round(progress.value)); // 0..0.5
        return {
            transform: [{ translateX: progress.value * tabWidth }, { scaleX: 1 + dist * stretch }],
        };
    });
}

/** Style for a tab's label: colour and scale blend as the pill passes over it. */
export function useTabLabelStyle(
    progress: SharedValue<number>,
    tabIndex: number,
    activeColor: string,
    inactiveColor: string,
    activeScale = 1.05
) {
    return useAnimatedStyle(() => {
        const range = [tabIndex - 1, tabIndex, tabIndex + 1];
        return {
            color: interpolateColor(progress.value, range, [inactiveColor, activeColor, inactiveColor]),
            transform: [
                { scale: interpolate(progress.value, range, [1, activeScale, 1], Extrapolation.CLAMP) },
            ],
        };
    });
}