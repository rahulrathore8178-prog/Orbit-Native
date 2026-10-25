import {
    C,
    Divider,
    enter,
    ErrorBanner,
    GlassCard,
    GoogleButton,
    OrbitBackdrop,
    OrbitCore,
    OrbitInput,
    OrbitRings,
    PrimaryButton,
} from '@/components/auth/OrbitAuth';
import { useGoogleAuth } from '@/components/auth/useGoogleAuth';
import { signIn } from '@/redux/slice/authSlice';
import { useAppDispatch } from '@/redux/store';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    DeviceEventEmitter,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../lib/utils';

export default function LoginScreen() {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();
    const google = useGoogleAuth();

    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const passwordRef = useRef<TextInput>(null);

    const canSubmit = emailOrUsername.trim().length > 0 && password.length > 0;

    const handleLogin = useCallback(async () => {
        if (!canSubmit || loading) return;
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/user/login`, {
                emailOrUsername: emailOrUsername.trim(),
                password,
            });
            if (!res.data?.token) throw new Error('Server did not return a token');

            // Saves token + user, then flips auth status. The guard in _layout.tsx moves
            // the user to the tabs, so no router call is needed here.
            await dispatch(signIn({ token: res.data.token, user: res.data.user })).unwrap();
            DeviceEventEmitter.emit('auth:user-updated');
        } catch (err: any) {
            setErrorMsg(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Login failed. Please check your credentials.',
            );
        } finally {
            setLoading(false);
        }
    }, [canSubmit, loading, emailOrUsername, password, dispatch]);

    const banner = errorMsg || google.error;

    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <StatusBar barStyle="light-content" />
            <OrbitBackdrop />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: 'center',
                        paddingHorizontal: 20,
                        paddingTop: insets.top + 12,
                        paddingBottom: insets.bottom + 24,
                    }}
                >
                    {/* Hero */}
                    <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', marginBottom: 14 }}>
                        <OrbitRings size={190}>
                            <OrbitCore size={52} />
                        </OrbitRings>
                        <Text
                            style={{
                                color: C.text,
                                fontSize: 30,
                                fontWeight: '800',
                                letterSpacing: 7,
                                marginTop: 6,
                                textShadowColor: 'rgba(109,139,255,0.65)',
                                textShadowRadius: 16,
                                textShadowOffset: { width: 0, height: 0 },
                            }}
                        >
                            ORBIT
                        </Text>
                        <Text style={{ color: C.mute, fontSize: 14, marginTop: 6 }}>
                            Welcome back. Re-enter your orbit.
                        </Text>
                    </Animated.View>

                    {/* Form */}
                    <Animated.View entering={enter(1)}>
                        <GlassCard>
                            <ErrorBanner message={banner} />

                            <View style={{ gap: 14 }}>
                                <OrbitInput
                                    label="Email or username"
                                    icon="person-outline"
                                    value={emailOrUsername}
                                    onChangeText={setEmailOrUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="username"
                                    textContentType="username"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                                <OrbitInput
                                    ref={passwordRef}
                                    label="Password"
                                    icon="lock-closed-outline"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureToggle
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="password"
                                    textContentType="password"
                                    returnKeyType="go"
                                    onSubmitEditing={handleLogin}
                                />
                            </View>

                            <Pressable
                                onPress={() => {
                                    // TODO: navigate to your "forgot password" flow
                                }}
                                hitSlop={8}
                                style={{ alignSelf: 'flex-end', marginTop: 12, marginBottom: 18 }}
                            >
                                <Text style={{ color: '#9DB2FF', fontSize: 13, fontWeight: '600' }}>Forgot password?</Text>
                            </Pressable>

                            <PrimaryButton title="Log in" onPress={handleLogin} loading={loading} disabled={!canSubmit} />

                            {google.googleEnabled ? (
                                <>
                                    <Divider />
                                    <GoogleButton onPress={google.signInWithGoogle} loading={google.loading} disabled={loading} />
                                </>
                            ) : null}
                        </GlassCard>
                    </Animated.View>

                    {/* Footer */}
                    <Animated.View entering={enter(2)} style={{ alignItems: 'center', marginTop: 22 }}>
                        <View style={{ flexDirection: 'row' }}>
                            <Text style={{ color: C.mute, fontSize: 14 }}>New to Orbit? </Text>
                            <Pressable onPress={() => router.push('/singup')} hitSlop={8}>
                                <Text style={{ color: '#9DB2FF', fontSize: 14, fontWeight: '700' }}>Create your orbit</Text>
                            </Pressable>
                        </View>
                        <Text style={{ color: C.dim, fontSize: 11.5, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
                            By continuing you agree to our Terms and Privacy Policy.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};