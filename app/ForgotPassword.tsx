import {
    C, ErrorBanner, GlassCard, OrbitBackdrop, OrbitCore, OrbitInput, OrbitRings, PrimaryButton, StrengthMeter,
} from '@/components/auth/OrbitAuth';
import OtpInput from '@/components/auth/OtpInput';
import { API_URL } from '@/lib/utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StatusBar, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'email' | 'reset' | 'done';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const friendly = (err: any): string => {
    if (err?.response?.data?.message) return err.response.data.message;
    if (err?.code === 'ECONNABORTED') return 'The server is waking up. Please try again in a few seconds.';
    if (axios.isAxiosError(err) && !err.response) return 'Network error. Check your connection and try again.';
    return err?.message || 'Something went wrong. Please try again.';
};

const buzz = (type: 'success' | 'error') =>
    Haptics.notificationAsync(
        type === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => { });

const COPY: Record<Step, { title: string; sub: string }> = {
    email: { title: 'Forgot your password?', sub: "Enter your email and we'll send you a 6-digit code." },
    reset: { title: 'Check your inbox', sub: 'Enter the code we sent and choose a new password.' },
    done: { title: "You're all set", sub: 'Your password has been updated.' },
};

export default function ForgotPasswordScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ email?: string }>();

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState(typeof params.email === 'string' && params.email.includes('@') ? params.email : '');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [otpError, setOtpError] = useState(false);

    const otpRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

    // resend countdown
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const goBack = useCallback(() => {
        if (step === 'reset') {
            setErrorMsg('');
            setStep('email');
            return;
        }
        if (router.canGoBack()) router.back();
        else router.replace('/');
    }, [step]);

    // Android hardware back: step back inside the flow first.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'reset') {
                setErrorMsg('');
                setStep('email');
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [step]);

    const sendCode = useCallback(async () => {
        if (loading) return;
        const e = email.trim().toLowerCase();
        if (!isEmail(e)) {
            setErrorMsg('Enter the email address of your account.');
            return;
        }
        setErrorMsg('');
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/user/forgot-password`, { email: e }, { timeout: 60000 });
            setEmail(e);
            setOtp('');
            setOtpError(false);
            setStep('reset');
            setCooldown(30);
            buzz('success');
        } catch (err) {
            setErrorMsg(friendly(err));
            buzz('error');
        } finally {
            setLoading(false);
        }
    }, [email, loading]);

    const mismatch = confirm.length > 0 && password !== confirm;
    const canReset = otp.length === 6 && password.length >= 6 && password === confirm;

    const resetPassword = useCallback(async () => {
        if (!canReset || loading) return;
        setErrorMsg('');
        setOtpError(false);
        setLoading(true);
        try {
            await axios.post(
                `${API_URL}/api/auth/user/reset-password`,
                { email, otp, newPassword: password },
                { timeout: 30000 },
            );
            buzz('success');
            setStep('done');
            redirectTimer.current = setTimeout(() => router.replace('/'), 1800);
        } catch (err: any) {
            const msg = friendly(err);
            setErrorMsg(msg);
            buzz('error');
            if (/code|attempt/i.test(msg)) {
                setOtpError(true);
                setOtp('');
                otpRef.current?.focus();
            }
        } finally {
            setLoading(false);
        }
    }, [canReset, loading, email, otp, password]);

    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <StatusBar barStyle="light-content" />
            <OrbitBackdrop />

            {step !== 'done' ? (
                <Pressable
                    onPress={goBack}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    style={{
                        position: 'absolute',
                        top: insets.top + 10,
                        left: 16,
                        zIndex: 10,
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: C.border,
                    }}
                >
                    <Ionicons name="chevron-back" size={20} color={C.text} />
                </Pressable>
            ) : null}

            <KeyboardAwareScrollView
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 56,
                    paddingBottom: insets.bottom + 24,
                }}
            >
                <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center' }}>
                    <OrbitRings size={190}>
                        <OrbitCore size={46} />
                    </OrbitRings>
                    <Animated.Text
                        key={`${step}-title`}
                        entering={FadeInDown.duration(320)}
                        style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 2, textAlign: 'center' }}
                    >
                        {COPY[step].title}
                    </Animated.Text>
                    <Animated.Text
                        key={`${step}-sub`}
                        entering={FadeInDown.duration(320).delay(60)}
                        style={{ color: C.mute, fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 12 }}
                    >
                        {COPY[step].sub}
                    </Animated.Text>
                </Animated.View>

                {step === 'email' ? (
                    <Animated.View key="email" entering={FadeInRight.duration(320)} style={{ marginTop: 18 }}>
                        <GlassCard>
                            <ErrorBanner message={errorMsg} />
                            <OrbitInput
                                label="Email"
                                icon="mail-outline"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                textContentType="emailAddress"
                                returnKeyType="send"
                                onSubmitEditing={sendCode}
                            />
                            <View style={{ height: 20 }} />
                            <PrimaryButton title="Send code" onPress={sendCode} loading={loading} disabled={!isEmail(email)} />
                        </GlassCard>
                    </Animated.View>
                ) : null}

                {step === 'reset' ? (
                    <Animated.View key="reset" entering={FadeInRight.duration(320)} style={{ marginTop: 18 }}>
                        <GlassCard>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 16,
                                }}
                            >
                                <Text style={{ color: C.mute, fontSize: 13, flex: 1 }} numberOfLines={1}>
                                    Code sent to <Text style={{ color: C.text, fontWeight: '600' }}>{email}</Text>
                                </Text>
                                <Pressable onPress={goBack} hitSlop={10}>
                                    <Text style={{ color: '#9DB2FF', fontSize: 13, fontWeight: '700', marginLeft: 10 }}>Change</Text>
                                </Pressable>
                            </View>

                            <ErrorBanner message={errorMsg} />

                            <OtpInput ref={otpRef} value={otp} onChange={(v) => { setOtp(v); if (otpError) setOtpError(false); }} error={otpError} autoFocus />

                            <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 18 }}>
                                {cooldown > 0 ? (
                                    <Text style={{ color: C.dim, fontSize: 13 }}>Resend code in {cooldown}s</Text>
                                ) : (
                                    <Pressable onPress={sendCode} hitSlop={10} disabled={loading}>
                                        <Text style={{ color: '#9DB2FF', fontSize: 13.5, fontWeight: '700' }}>Resend code</Text>
                                    </Pressable>
                                )}
                            </View>

                            <View style={{ gap: 14 }}>
                                <OrbitInput
                                    label="New password"
                                    icon="lock-closed-outline"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureToggle
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="password-new"
                                    textContentType="newPassword"
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmRef.current?.focus()}
                                    submitBehavior="submit"
                                />
                                <StrengthMeter password={password} />
                                <OrbitInput
                                    ref={confirmRef}
                                    label="Confirm password"
                                    icon="shield-checkmark-outline"
                                    value={confirm}
                                    onChangeText={setConfirm}
                                    secureToggle
                                    error={mismatch}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="password-new"
                                    textContentType="newPassword"
                                    returnKeyType="go"
                                    onSubmitEditing={resetPassword}
                                />
                                {mismatch ? (
                                    <Text style={{ color: C.danger, fontSize: 12.5, marginTop: -6, paddingHorizontal: 2 }}>
                                        Passwords do not match.
                                    </Text>
                                ) : null}
                            </View>

                            <View style={{ height: 20 }} />
                            <PrimaryButton title="Reset password" onPress={resetPassword} loading={loading} disabled={!canReset} />
                        </GlassCard>
                    </Animated.View>
                ) : null}

                {step === 'done' ? (
                    <Animated.View key="done" entering={FadeIn.duration(250)} style={{ marginTop: 26, alignItems: 'center' }}>
                        <Animated.View entering={ZoomIn.springify().damping(13)}>
                            <LinearGradient
                                colors={[C.ok, '#34D399']}
                                style={{
                                    width: 84,
                                    height: 84,
                                    borderRadius: 42,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: C.ok,
                                    shadowOpacity: 0.5,
                                    shadowRadius: 24,
                                    shadowOffset: { width: 0, height: 0 },
                                    elevation: 10,
                                }}
                            >
                                <Ionicons name="checkmark" size={44} color="#05070C" />
                            </LinearGradient>
                        </Animated.View>
                        <Text style={{ color: C.mute, fontSize: 13.5, marginTop: 18 }}>Taking you to login…</Text>
                        <View style={{ width: '100%', marginTop: 18 }}>
                            <PrimaryButton
                                title="Back to login"
                                onPress={() => {
                                    if (redirectTimer.current) clearTimeout(redirectTimer.current);
                                    router.replace('/');
                                }}
                            />
                        </View>
                    </Animated.View>
                ) : null}
            </KeyboardAwareScrollView>
        </View>
    );
}