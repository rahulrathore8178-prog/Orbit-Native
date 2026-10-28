import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * Keyboard avoidance for a bottom sheet inside a <Modal>.
 *
 * Instead of assuming the keyboard height, it measures how much of the sheet's container
 * the keyboard actually covers:
 *   - window NOT resized by the keyboard (iOS, edge-to-edge Android)  -> overlap = keyboard height
 *   - window resized by the keyboard (Android adjustResize)           -> overlap = 0, no double offset
 * That double offset is what pushed the composer under or away from the keyboard.
 *
 * Usage:
 *   const containerRef = useRef<View>(null);
 *   const { anim, visible } = useKeyboardOverlap(containerRef, mounted);
 *   <Animated.View ref={containerRef as any} collapsable={false} style={{ flex: 1, paddingBottom: anim }} />
 */
export function useKeyboardOverlap(containerRef: React.RefObject<any>, enabled = true) {
    const anim = useRef(new Animated.Value(0)).current;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!enabled) {
            anim.setValue(0);
            setVisible(false);
            return;
        }

        const ios = Platform.OS === 'ios';
        const run = (to: number, duration: number) =>
            Animated.timing(anim, {
                toValue: to,
                duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false, // padding cannot use the native driver
            }).start();

        const onShow = (e: KeyboardEvent) => {
            const kbTop = e.endCoordinates.screenY;
            const up = e.endCoordinates.height > 0 && kbTop < Dimensions.get('screen').height - 1;
            const duration = ios ? e.duration || 250 : 180;

            const apply = (overlap: number) => {
                setVisible(up);
                run(up ? overlap : 0, duration);
            };

            const node = containerRef.current;
            if (!node?.measureInWindow) return apply(e.endCoordinates.height);
            node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
                apply(Math.max(0, Math.round(y + h - kbTop)));
            });
        };

        const onHide = (e?: KeyboardEvent) => {
            setVisible(false);
            run(0, ios ? e?.duration || 250 : 160);
        };

        const subs = [
            Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidShow', onShow),
            Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
        ];
        return () => subs.forEach((s) => s.remove());
    }, [enabled, anim, containerRef]);

    return { anim, visible };
}