import { authStorage } from '@/lib/auth/authStorage';
import { getDisplayImageUrl } from '@/lib/utils';
import { accountsSynced, switchAccount } from '@/redux/slice/authSlice';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useMemo } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

// Spring for finger-following and snap-back. overshootClamping keeps the neighbour pic from showing a gap.
const SLIDE = { damping: 24, stiffness: 340, mass: 0.7, overshootClamping: true };
const PRESS = { damping: 18, stiffness: 420 };
const LAND = { damping: 11, stiffness: 240, mass: 0.8 };

const COMMIT = 0.3; // fraction of the circle you must drag to switch

// Committed slide: eased glide, slower the more distance is left (duration = MIN + EXTRA * remaining)
const GLIDE = Easing.bezier(0.22, 1, 0.36, 1);
const GLIDE_MIN_MS = 260;
const GLIDE_EXTRA_MS = 180;

// Landing: pop + ring pulse, then a short beat so the user actually sees it before the app switches
const POP_EASE = Easing.out(Easing.quad);
const RING_EASE = Easing.out(Easing.cubic);
const RING_MS = 520;
const HOLD_MS = 240;

const haptic = (kind: 'tick' | 'commit') => {
    if (Platform.OS === 'web') return;
    (kind === 'tick'
        ? Haptics.selectionAsync()
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    ).catch(() => { });
};

const Face = memo(function Face({ pic, name }: { pic?: string; name?: string }) {
    return (
        <View className="flex-1 items-center justify-center bg-[#1B2030]">
            {pic ? (
                <Image source={{ uri: getDisplayImageUrl(pic) }} className="h-full w-full" resizeMode="cover" />
            ) : (
                <Text className="text-base font-bold text-white/80">{(name?.[0] ?? '?').toUpperCase()}</Text>
            )}
        </View>
    );
});

type Props = {
    size?: number;
    currentPic?: string;
    onPress: () => void;
    onLongPress: () => void;
};

export default function AccountSwipeAvatar({ size = 40, currentPic, onPress, onLongPress }: Props) {
    const dispatch = useAppDispatch();
    const accounts = useAppSelector((s) => s.auth.accounts);
    const activeId = useAppSelector((s) => s.auth.activeAccountId);

    const n = accounts.length;
    const idx = accounts.findIndex((a) => a.id === activeId);
    const canSwipe = n > 1 && idx >= 0;

    const cur: any = idx >= 0 ? accounts[idx].user : null;
    const next: any = canSwipe ? accounts[(idx + 1) % n].user : null;
    const prev: any = canSwipe ? accounts[(idx - 1 + n) % n].user : null;

    const t = useSharedValue(0); // vertical offset of the current pic: -size (up) .. +size (down)
    const scale = useSharedValue(1);
    const pulse = useSharedValue(0); // 0 -> 1 ring pulse
    const armed = useSharedValue(false);
    const locked = useSharedValue(false);

    const goTo = useCallback(
        async (dir: -1 | 1, hold = false) => {
            if (!canSwipe) return;
            // swipe up (dir -1) = next account, swipe down (dir +1) = previous
            const target = accounts[(idx + (dir === -1 ? 1 : -1) + n) % n];
            haptic('commit');
            if (hold) await new Promise<void>((r) => setTimeout(r, HOLD_MS));
            try {
                await dispatch(switchAccount(target.id)).unwrap();
            } catch (e: any) {
                dispatch(accountsSynced(await authStorage.getSnapshot()));
                pulse.value = 0;
                t.value = withSpring(0, SLIDE);
                locked.value = false;
                Alert.alert('Could not switch', e?.message ?? 'Please try again.');
            }
        },
        [accounts, idx, n, canSwipe, dispatch, t, pulse, locked]
    );

    const gesture = useMemo(() => {
        const pan = Gesture.Pan()
            .enabled(canSwipe)
            .activeOffsetY([-6, 6])
            .failOffsetX([-24, 24])
            .onBegin(() => {
                scale.value = withSpring(0.92, PRESS);
            })
            .onStart(() => {
                armed.value = false;
            })
            .onUpdate((e) => {
                if (locked.value) return;
                const y = Math.max(-size, Math.min(size, e.translationY));
                t.value = y;
                const now = Math.abs(y) > size * COMMIT;
                if (now !== armed.value) {
                    armed.value = now;
                    if (now) runOnJS(haptic)('tick');
                }
            })
            .onEnd((e) => {
                if (locked.value) return;
                const dir: -1 | 1 = t.value < 0 ? -1 : 1;
                const flick = Math.abs(e.velocityY) > 700 && Math.sign(e.velocityY) === dir;
                if (Math.abs(t.value) > size * COMMIT || flick) {
                    locked.value = true;
                    const remaining = (size - Math.abs(t.value)) / size; // 1 = full distance left
                    t.value = withTiming(
                        dir * size,
                        { duration: GLIDE_MIN_MS + GLIDE_EXTRA_MS * remaining, easing: GLIDE },
                        (finished) => {
                            if (!finished) return;
                            // landing: pop + ring pulse, then switch after a short beat
                            scale.value = withSequence(
                                withTiming(1.14, { duration: 150, easing: POP_EASE }),
                                withSpring(1, LAND)
                            );
                            pulse.value = 0;
                            pulse.value = withTiming(1, { duration: RING_MS, easing: RING_EASE });
                            runOnJS(goTo)(dir, true);
                        }
                    );
                } else {
                    t.value = withSpring(0, SLIDE);
                }
            })
            .onFinalize(() => {
                scale.value = withSpring(1, PRESS);
            });

        const tap = Gesture.Tap()
            .maxDuration(400)
            .onBegin(() => {
                scale.value = withSpring(0.92, PRESS);
            })
            .onEnd((_e, success) => {
                if (success) runOnJS(onPress)();
            })
            .onFinalize(() => {
                scale.value = withSpring(1, PRESS);
            });

        const long = Gesture.LongPress()
            .minDuration(350)
            .onStart(() => {
                runOnJS(haptic)('commit');
                runOnJS(onLongPress)();
            });

        // pan wins on vertical movement; long-press beats tap if the finger stays down
        return Gesture.Race(pan, Gesture.Exclusive(long, tap));
    }, [canSwipe, size, goTo, onPress, onLongPress, t, scale, pulse, armed, locked]);

    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const currentStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: t.value }],
        opacity: interpolate(Math.abs(t.value), [0, size], [1, 0.35], Extrapolation.CLAMP),
    }));
    const nextStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: t.value + size }],
        opacity: interpolate(t.value, [-size, 0], [1, 0.4], Extrapolation.CLAMP),
    }));
    const prevStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: t.value - size }],
        opacity: interpolate(t.value, [0, size], [0.4, 1], Extrapolation.CLAMP),
    }));
    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5], Extrapolation.CLAMP) }],
        opacity: interpolate(pulse.value, [0, 0.12, 1], [0, 0.7, 0], Extrapolation.CLAMP),
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Reanimated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Account switcher"
                accessibilityHint="Swipe up or down to switch account. Double tap to open the menu."
                accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'activate') onPress();
                    else if (e.nativeEvent.actionName === 'increment') goTo(-1);
                    else if (e.nativeEvent.actionName === 'decrement') goTo(1);
                }}
                style={[{ width: size, height: size }, pressStyle]}
            >
                {/* landing ring: sits behind and expands past the circle */}
                <Reanimated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, ringStyle]}
                    className="rounded-full border-2 border-[#1D9BF0]"
                />

                <View className="flex-1 overflow-hidden rounded-full bg-[#1B2030]">
                    {canSwipe ? (
                        <>
                            <Reanimated.View style={[StyleSheet.absoluteFill, prevStyle]}>
                                <Face pic={prev?.profilePic} name={prev?.username} />
                            </Reanimated.View>
                            <Reanimated.View style={[StyleSheet.absoluteFill, nextStyle]}>
                                <Face pic={next?.profilePic} name={next?.username} />
                            </Reanimated.View>
                        </>
                    ) : null}
                    <Reanimated.View style={[StyleSheet.absoluteFill, currentStyle]}>
                        <Face pic={currentPic ?? cur?.profilePic} name={cur?.username} />
                    </Reanimated.View>
                </View>
                <View pointerEvents="none" className="absolute inset-0 rounded-full border border-white/20" />
            </Reanimated.View>
        </GestureDetector>
    );
}