import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform } from 'react-native';

/** Animated keyboard height (for padding) + a visible flag. */
export function useKeyboardAnim() {
    const anim = useRef(new Animated.Value(0)).current;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const ios = Platform.OS === 'ios';
        const move = (to: number, duration: number) =>
            Animated.timing(anim, {
                toValue: to,
                duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false, // paddingBottom can't use the native driver
            }).start();

        const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
            setVisible(true);
            move(e.endCoordinates.height, ios ? e.duration || 250 : 200);
        });
        const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
            setVisible(false);
            move(0, ios ? e?.duration || 220 : 160);
        });
        return () => {
            show.remove();
            hide.remove();
        };
    }, [anim]);

    return { anim, visible };
}