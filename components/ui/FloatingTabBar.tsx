import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const BAR_HEIGHT = 70;
const BORDER = 1;
const PILL_WIDTH = 70;
const PILL_HEIGHT = 50;
const PRESS_SCALE = 1.12;
const FLICK_MS = 120; // how far ahead a flick "projects" the bubble

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// smooth resistance when dragging past the first/last tab
const rubber = (over: number) => 8 * (1 - Math.exp(-over / 24));

const tick = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => { });
};

const SPRING = { useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 } as const;

export function FloatingTabBar(props: any) {
    const { state, descriptors, emitter, navigateToTab } = props;
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const count = state.routes.length;
    const BAR_WIDTH = Math.min(width - 40, 400);
    const innerWidth = BAR_WIDTH - BORDER * 2;
    const innerHeight = BAR_HEIGHT - BORDER * 2;
    const tabWidth = innerWidth / count;

    const getX = useCallback(
        (index: number) => index * tabWidth + (tabWidth - PILL_WIDTH) / 2,
        [tabWidth],
    );

    const translateX = useRef(new Animated.Value(getX(state.index))).current;
    const scale = useRef(new Animated.Value(1)).current;
    const glow = useRef(new Animated.Value(0)).current;
    const scaleY = scale.interpolate({ inputRange: [1, PRESS_SCALE], outputRange: [1, 1.07] });

    // which tab the bubble is currently over while dragging (null = not dragging)
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const barRef = useRef<View>(null);
    const barLeft = useRef<number | null>(null);
    const dragging = useRef(false);
    const startX = useRef(0);
    const moved = useRef(false);
    const hover = useRef(0);
    const [pending, setPending] = useState<number | null>(null);
    const heading = useRef(state.index); // tab the bubble is currently animating toward

    // same behaviour as before: emit tabPress, navigate only if not focused and not prevented.
    // returns false when a listener prevented the navigation.
    const selectTab = (index: number): boolean => {
        const route = state.routes[index];
        const event = emitter?.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event?.defaultPrevented) return false;
        if (state.index !== index) navigateToTab(route.key);
        return true;
    };

    // the pan handlers are created once, so they read the latest values from here
    const live = useRef<any>({});
    live.current = { index: state.index, tabWidth, count, getX, selectTab, fallbackLeft: (width - BAR_WIDTH) / 2 };

    const panResponder = useRef(
        PanResponder.create({
            // only grab the touch when it starts on the active tab (the bubble)
            onStartShouldSetPanResponderCapture: (e) => {
                const { index, tabWidth: tw, fallbackLeft } = live.current;
                const left = barLeft.current ?? fallbackLeft;
                const relX = e.nativeEvent.pageX - left - BORDER;
                return relX >= index * tw && relX <= (index + 1) * tw;
            },
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: () => {
                const { index, getX: gx } = live.current;
                dragging.current = true;
                moved.current = false;
                hover.current = index;
                translateX.stopAnimation();
                startX.current = gx(index);

                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                Animated.spring(scale, { toValue: PRESS_SCALE, useNativeDriver: true, damping: 14, stiffness: 240, mass: 0.7 }).start();
                Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }).start();
            },

            onPanResponderMove: (_, g) => {
                const { tabWidth: tw, count: n, getX: gx } = live.current;
                const min = gx(0);
                const max = gx(n - 1);

                let x = startX.current + g.dx;
                if (x < min) x = min - rubber(min - x);
                else if (x > max) x = max + rubber(x - max);

                if (Math.abs(g.dx) > 4) moved.current = true;
                translateX.setValue(x);

                const i = clamp(Math.round((x - min) / tw), 0, n - 1);
                if (i !== hover.current) {
                    hover.current = i;
                    setHoverIndex(i);
                    tick();
                }
            },

            onPanResponderRelease: (_, g) => finish(g, false),
            onPanResponderTerminate: (_, g) => finish(g, true),
        }),
    ).current;

    function finish(g: { dx: number; vx: number }, cancelled: boolean) {
        const { index, tabWidth: tw, count: n, getX: gx, selectTab: select } = live.current;
        dragging.current = false;
        setHoverIndex(null);

        const min = gx(0);
        const max = gx(n - 1);
        const x = clamp(startX.current + g.dx, min, max);
        const projected = clamp(x + g.vx * FLICK_MS, min, max);
        const target = cancelled ? index : clamp(Math.round((projected - min) / tw), 0, n - 1);

        heading.current = target;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220, mass: 0.7 }).start();
        Animated.timing(glow, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        Animated.spring(translateX, { toValue: gx(target), velocity: g.vx * 1000, ...SPRING }).start();

        if (cancelled) return;

        if (target === index) {
            if (!moved.current) select(index); // plain tap on the active tab
            return;
        }

        setPending(target);          // keep the new icon highlighted right away
        const ok = select(target);   // navigate immediately
        if (!ok) {
            heading.current = live.current.index;
            setPending(null);
            Animated.spring(translateX, { toValue: gx(live.current.index), ...SPRING }).start();
        }
    }

    // taps on other tabs (and external navigation) slide the bubble over
    useEffect(() => {
        setPending(null);
        if (dragging.current) return;
        if (heading.current === state.index) return; // bubble is already on its way
        heading.current = state.index;
        Animated.spring(translateX, { toValue: getX(state.index), ...SPRING }).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.index]);

    // keep the bubble aligned if the bar width changes (rotation, split screen)
    useEffect(() => {
        translateX.setValue(getX(state.index));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabWidth]);

    const shownIndex = hoverIndex ?? pending ?? state.index;

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: Math.max(insets.bottom, 18),
                alignItems: 'center',
            }}
        >
            <View
                ref={barRef}
                collapsable={false}
                onLayout={() => barRef.current?.measureInWindow((x) => { barLeft.current = x; })}
                {...panResponder.panHandlers}
                style={{
                    width: BAR_WIDTH,
                    height: BAR_HEIGHT,
                    borderRadius: BAR_HEIGHT / 2,
                    flexDirection: 'row',
                    borderWidth: BORDER,
                    backgroundColor: 'rgba(16,16,20,0.95)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.35,
                    shadowRadius: 24,
                    elevation: 20,
                    overflow: 'hidden',
                }}
            >
                {/* the draggable glass bubble */}
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: (innerHeight - PILL_HEIGHT) / 2,
                        left: 0,
                        width: PILL_WIDTH,
                        height: PILL_HEIGHT,
                        borderRadius: PILL_HEIGHT / 2,
                        backgroundColor: 'rgba(255,255,255,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.12)',
                        transform: [{ translateX }, { scaleX: scale }, { scaleY }],
                    }}
                >
                    {/* brighter layer that fades in while held */}
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFillObject,
                            { borderRadius: PILL_HEIGHT / 2, backgroundColor: 'rgba(255,255,255,0.12)', opacity: glow },
                        ]}
                    />
                </Animated.View>

                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const focused = shownIndex === index;
                    const color = focused ? '#ffffff' : 'rgba(255,255,255,0.45)';

                    return (
                        <Pressable
                            key={route.key}
                            onPress={() => selectTab(index)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: state.index === index }}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {options.tabBarIcon?.({ focused, color, size: 24 })}
                            <Text style={{ color, fontSize: 11, marginTop: 2 }}>
                                {typeof options.title === 'string' ? options.title : route.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}