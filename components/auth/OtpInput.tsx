import { C } from '@/components/auth/OrbitAuth';
import React, { forwardRef, memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    value: string;
    onChange: (v: string) => void;
    length?: number;
    error?: boolean;
    autoFocus?: boolean;
};

const Box = memo(function Box({ char, active, error }: { char: string; active: boolean; error: boolean }) {
    const pop = useSharedValue(1);
    const act = useSharedValue(0);

    useEffect(() => {
        act.value = withTiming(active ? 1 : 0, { duration: 160 });
    }, [active, act]);

    useEffect(() => {
        if (char) pop.value = withSequence(withTiming(1.14, { duration: 70 }), withSpring(1, { damping: 12, stiffness: 300 }));
    }, [char, pop]);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: pop.value }],
        borderColor: error ? C.danger : interpolateColor(act.value, [0, 1], ['rgba(255,255,255,0.08)', C.accent]),
        shadowOpacity: act.value * 0.35,
    }));

    return (
        <Animated.View
            style={[
                {
                    flex: 1,
                    height: 58,
                    borderRadius: 14,
                    borderWidth: 1,
                    backgroundColor: C.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: C.accent,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                },
                style,
            ]}
        >
            <Animated.Text style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>{char}</Animated.Text>
        </Animated.View>
    );
});

const OtpInput = forwardRef<TextInput, Props>(function OtpInput(
    { value, onChange, length = 6, error = false, autoFocus },
    ref,
) {
    const inner = useRef<TextInput>(null);
    const setRef = (node: TextInput | null) => {
        inner.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<TextInput | null>).current = node;
    };

    useEffect(() => {
        if (!autoFocus) return;
        const t = setTimeout(() => inner.current?.focus(), 350); // wait for the entrance animation
        return () => clearTimeout(t);
    }, [autoFocus]);

    const activeIndex = Math.min(value.length, length - 1);

    return (
        <View style={{ height: 58 }}>
            <View style={{ flexDirection: 'row', gap: 8 }} pointerEvents="none">
                {Array.from({ length }, (_, i) => (
                    <Box key={i} char={value[i] ?? ''} active={i === activeIndex} error={error} />
                ))}
            </View>
            {/* One invisible input over the boxes, so paste and SMS autofill work. */}
            <TextInput
                ref={setRef}
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
                keyboardType="number-pad"
                maxLength={length}
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                caretHidden
                selectionColor="transparent"
                accessibilityLabel="Verification code"
                style={[StyleSheet.absoluteFill, { opacity: 0.02, color: 'transparent' }]}
            />
        </View>
    );
});

export default memo(OtpInput);