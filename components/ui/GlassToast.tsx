import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    cancelAnimation,
    makeMutable,
    runOnJS,
    useAnimatedStyle,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, getDisplayImageUrl } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type ToastVariant = 'success' | 'error' | 'info' | 'message';

export type ToastOptions = {
    /** Main line. */
    title: string;
    /** Optional second line (muted). */
    subtitle?: string;
    /** In-app route to open when the toast is tapped, e.g. "/chat/123". A chevron is shown when set. */
    url?: string;
    /** Custom tap handler (runs before navigation). */
    onPress?: () => void;
    /** Sender / subject picture. Server paths and Drive links are resolved for you. Replaces the icon. */
    avatar?: string;
    /** Override the variant's default icon. */
    icon?: keyof typeof Ionicons.glyphMap;
    /** success (default) | error | info | message */
    variant?: ToastVariant;
    /** How long it stays after landing, in ms. Default: 2200, or 4500 when `url` is set. */
    duration?: number;
    /** Haptic on appear. Default true. */
    haptic?: boolean;
};

/**
 * Show a glass toast from anywhere (components, hooks, socket / push handlers, services).
 * A new toast replaces the current one in place — no stacking, no flicker.
 */
export function showToast(options: ToastOptions) {
    const opts: ToastOptions = { variant: 'success', haptic: true, ...options };
    current = opts;
    emit();

    dismissed.value = false;
    hold.value = opts.duration ?? (opts.url || opts.onPress ? 4500 : 2200);
    topY.value = topInset + 10;
    pulse.value = 0.95;
    pulse.value = withSpring(1, { damping: 14, stiffness: 260 });
    showSequence();

    if (opts.haptic !== false && Platform.OS !== 'web') {
        if (opts.variant === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else if (opts.variant === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    AccessibilityInfo.announceForAccessibility(opts.subtitle ? `${opts.title}. ${opts.subtitle}` : opts.title);
}

export function hideToast() {
    hideNow();
}

/** Hook flavour: `const toast = useToast(); toast.show({ title: 'Saved' })`. Stable identity, never re-renders. */
export function useToast() {
    return useMemo(() => ({ show: showToast, hide: hideToast }), []);
}

/** Server paths get the host; absolute (Drive) links go through getDisplayImageUrl — same as Postcard. */
export function resolveImageUri(val?: string): string | undefined {
    if (!val) return undefined;
    if (val.startsWith('/')) return `${API_URL}${val}`;
    try {
        return (getDisplayImageUrl(val) as string | undefined) || val;
    } catch {
        return val;
    }
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

const HIDDEN = -190;

let current: ToastOptions = { title: '', variant: 'success' };
let topInset = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

// UI-thread state
const y = makeMutable(HIDDEN);
const topY = makeMutable(10);
const hold = makeMutable(2200);
const pulse = makeMutable(1);
const dismissed = makeMutable(true);

/** Drop in from the top with a soft overshoot, wait, then glide back up. */
function showSequence() {
    'worklet';
    y.value = withSequence(
        withSpring(topY.value, { damping: 13, stiffness: 170, mass: 0.9 }),
        withDelay(
            hold.value,
            withTiming(HIDDEN, { duration: 340, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) dismissed.value = true;
            }),
        ),
    );
}

function hideNow() {
    'worklet';
    dismissed.value = true;
    y.value = withTiming(HIDDEN, { duration: 260, easing: Easing.in(Easing.cubic) });
}

const DEFAULT_ICON: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
    success: 'checkmark',
    error: 'close',
    info: 'information',
    message: 'chatbubble',
};

const BADGE_BG: Record<ToastVariant, string> = {
    success: 'rgba(255,255,255,0.95)',
    error: 'rgba(251,113,133,0.95)',
    info: 'rgba(255,255,255,0.95)',
    message: 'rgba(255,255,255,0.95)',
};

const Leading = ({ opts }: { opts: ToastOptions }) => {
    const [failed, setFailed] = useState(false);
    const variant = opts.variant ?? 'success';
    const uri = resolveImageUri(opts.avatar);
    useEffect(() => setFailed(false), [uri]);

    if (uri && !failed) {
        return (
            <Image
                source={{ uri }}
                onError={() => setFailed(true)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)' }}
            />
        );
    }
    return (
        <View
            style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: BADGE_BG[variant],
            }}
        >
            <Ionicons name={opts.icon ?? DEFAULT_ICON[variant]} size={16} color="#0a0c12" />
        </View>
    );
};

/** Mount ONCE near the app root (ShareQuickHost already renders it for you). */
export function GlassToastHost() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const opts = useSyncExternalStore(subscribe, () => current);

    useEffect(() => {
        topInset = insets.top;
        topY.value = insets.top + 10;
    }, [insets.top]);

    const onTap = useMemo(
        () => () => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            current.onPress?.();
            if (current.url) {
                try {
                    router.push(current.url as any);
                } catch (e) {
                    console.warn('[Toast] could not open', current.url, e);
                }
            }
        },
        [],
    );

    const gesture = useMemo(() => {
        // swipe up to dismiss; hold to keep it open; tap to open the link
        const pan = Gesture.Pan()
            .activeOffsetY([-6, 6])
            .onBegin(() => {
                'worklet';
                cancelAnimation(y); // pause the auto-hide while a finger is on it
            })
            .onUpdate((e) => {
                'worklet';
                const t = e.translationY;
                y.value = topY.value + (t < 0 ? t : t * 0.15); // free upward, rubber-band downward
            })
            .onEnd((e) => {
                'worklet';
                if (e.translationY < -24 || e.velocityY < -500) hideNow();
                else showSequence();
            })
            .onFinalize((_e, success) => {
                'worklet';
                if (!success && !dismissed.value) showSequence(); // finger lifted without dragging
            });

        const tap = Gesture.Tap()
            .maxDuration(450)
            .onEnd((_e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(onTap)();
                hideNow();
            });

        return Gesture.Race(pan, tap);
    }, [onTap]);

    const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
    const pill = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    const variant = opts.variant ?? 'success';
    const tappable = Boolean(opts.url || opts.onPress);

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 999 }, wrap]}
        >
            <GestureDetector gesture={gesture}>
                <Animated.View
                    accessible
                    accessibilityRole={tappable ? 'button' : 'alert'}
                    accessibilityLabel={opts.subtitle ? `${opts.title}. ${opts.subtitle}` : opts.title}
                    accessibilityHint={opts.url ? 'Double tap to open' : undefined}
                    style={[
                        {
                            maxWidth: width - 32,
                            minWidth: 150,
                            borderRadius: 26,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.18)',
                        },
                        pill,
                    ]}
                >
                    <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,18,0.62)' }]} />
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingLeft: 12,
                            paddingRight: tappable ? 12 : 20,
                        }}
                    >
                        <Leading opts={opts} />
                        <View style={{ marginLeft: 10, flexShrink: 1 }}>
                            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                                {opts.title}
                            </Text>
                            {opts.subtitle ? (
                                <Text
                                    numberOfLines={1}
                                    style={{ marginTop: 1, color: 'rgba(255,255,255,0.65)', fontSize: 12.5 }}
                                >
                                    {opts.subtitle}
                                </Text>
                            ) : null}
                        </View>
                        {tappable ? (
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="rgba(255,255,255,0.55)"
                                style={{ marginLeft: 8 }}
                            />
                        ) : null}
                    </View>
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    );
}