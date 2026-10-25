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
    StrengthMeter,
} from '@/components/auth/OrbitAuth';
import { useGoogleAuth } from '@/components/auth/useGoogleAuth';
import { signIn } from '@/redux/slice/authSlice';
import { useAppDispatch } from '@/redux/store';
import Ionicons from '@expo/vector-icons/Ionicons';
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

export default function SignUpScreen() {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();
    const google = useGoogleAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const emailRef = useRef<TextInput>(null);
    const passRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const mismatch = confirm.length > 0 && password !== confirm;
    const isValid =
        username.trim().length >= 3 && email.includes('@') && password.length >= 6 && password === confirm;

    const handleSubmit = useCallback(async () => {
        if (!isValid || loading) return;
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/user/register`, {
                username: username.trim(),
                email: email.trim().toLowerCase(),
                password,
            });
            if (!res.data?.token || !res.data?.user) {
                throw new Error('Account created, but the server did not return a session. Please log in.');
            }
            // The guard in _layout.tsx moves the user to the tabs once auth flips.
            await dispatch(signIn({ token: res.data.token, user: res.data.user })).unwrap();
            DeviceEventEmitter.emit('auth:user-updated');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message ?? err.message ?? 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [isValid, loading, username, email, password, dispatch]);

    const banner = errorMsg || google.error;

    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <StatusBar barStyle="light-content" />
            <OrbitBackdrop />

            <Pressable
                onPress={() => router.replace('/home')}
                hitSlop={10}
                accessibilityLabel="Back to login"
                style={{
                    position: 'absolute',
                    top: insets.top + 8,
                    left: 16,
                    zIndex: 10,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: C.border,
                }}
            >
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: 'center',
                        paddingHorizontal: 20,
                        paddingTop: insets.top + 24,
                        paddingBottom: insets.bottom + 24,
                    }}
                >
                    <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', marginBottom: 10 }}>
                        <OrbitRings size={150}>
                            <OrbitCore size={42} />
                        </OrbitRings>
                        <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4, letterSpacing: 0.3 }}>
                            Create your orbit
                        </Text>
                        <Text style={{ color: C.mute, fontSize: 14, marginTop: 6 }}>Join the community in a few seconds.</Text>
                    </Animated.View>

                    <Animated.View entering={enter(1)}>
                        <GlassCard>
                            <ErrorBanner message={banner} />

                            <View style={{ gap: 14 }}>
                                <OrbitInput
                                    label="Username"
                                    icon="at-outline"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="username-new"
                                    textContentType="username"
                                    returnKeyType="next"
                                    onSubmitEditing={() => emailRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                                <OrbitInput
                                    ref={emailRef}
                                    label="Email address"
                                    icon="mail-outline"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    textContentType="emailAddress"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                                <OrbitInput
                                    ref={passRef}
                                    label="Password"
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
                                    blurOnSubmit={false}
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
                                    onSubmitEditing={handleSubmit}
                                />
                                {mismatch ? (
                                    <Text style={{ color: C.danger, fontSize: 12.5, marginTop: -6, paddingHorizontal: 2 }}>
                                        Passwords do not match.
                                    </Text>
                                ) : null}
                            </View>

                            <View style={{ height: 20 }} />
                            <PrimaryButton title="Create account" onPress={handleSubmit} loading={loading} disabled={!isValid} />

                            {google.googleEnabled ? (
                                <>
                                    <Divider />
                                    <GoogleButton
                                        label="Sign up with Google"
                                        onPress={google.signInWithGoogle}
                                        loading={google.loading}
                                        disabled={loading}
                                    />
                                </>
                            ) : null}
                        </GlassCard>
                    </Animated.View>

                    <Animated.View entering={enter(2)} style={{ alignItems: 'center', marginTop: 22 }}>
                        <View style={{ flexDirection: 'row' }}>
                            <Text style={{ color: C.mute, fontSize: 14 }}>Already in orbit? </Text>
                            <Pressable onPress={() => router.replace('/')} hitSlop={8}>
                                <Text style={{ color: '#9DB2FF', fontSize: 14, fontWeight: '700' }}>Log in</Text>
                            </Pressable>
                        </View>
                        <Text style={{ color: C.dim, fontSize: 11.5, textAlign: 'center', marginTop: 14 }}>
                            By signing up you agree to our Terms and Privacy Policy.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};