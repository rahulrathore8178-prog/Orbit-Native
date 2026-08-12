import React, { useState } from 'react';
import {
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StyleSheet,
    Pressable,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// npm i @react-native-async-storage/async-storage  (this is RN's equivalent of localStorage)
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

// TODO: import this from wherever your login screen defines it, so both
// screens use the exact same accent color instead of two hardcoded copies.
const ACCENT_BLUE = '#4da3ff';

// TODO: point this at wherever your login screen reads the API base URL from
// (e.g. app.config.ts / react-native-config). import.meta.env is web-only.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Welcome: undefined;
};

type SignUpNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

interface RegisteredUser {
    id: string;
    username: string;
    email: string;
    [key: string]: unknown;
}

interface RegisterResponse {
    token?: string;
    user?: RegisteredUser;
    message?: string;
}

export default function SignUpScreen() {
    const navigation = useNavigation<SignUpNavigationProp>();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [secureText, setSecureText] = useState(true);
    const [secureConfirmText, setSecureConfirmText] = useState(true);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const isValid =
        username.trim().length >= 3 &&
        email.includes('@') &&
        password.length >= 6 &&
        password === confirmPassword;

    const handleSubmit = async () => {
        if (!isValid) return;
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await axios.post<RegisterResponse>(`${API_URL}/api/auth/user/register`, {
                username: username.trim(),
                email: email.trim().toLowerCase(),
                password,
            });

            if (res.data?.token) {
                await AsyncStorage.setItem('token', res.data.token);
            }
            if (res.data?.user) {
                await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
            }

            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } } };
            setErrorMsg(error.response?.data?.message ?? 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        navigation.navigate('Login');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#121214" />
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    <View style={styles.card}>
                    <Pressable
                        onPress={() => router.push('/')}
                        hitSlop={8}
                        className="h-9 w-9 items-center justify-center rounded-full bg-white/5 active:bg-white/10"
                    >
                        <ChevronLeft style={{ backgroundColor: 'transparent' }}  size={20} color="#ffffff" />
                    </Pressable>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Sign up to get started</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={[styles.input, focusedField === 'username' && styles.inputFocused]}
                                placeholder="yourname"
                                placeholderTextColor="#6b6b70"
                                value={username}
                                onChangeText={setUsername}
                                onFocus={() => setFocusedField('username')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                                placeholder="you@example.com"
                                placeholderTextColor="#6b6b70"
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={[styles.passwordRow, focusedField === 'password' && styles.inputFocused]}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    placeholderTextColor="#6b6b70"
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                    secureTextEntry={secureText}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                                    <Text style={styles.toggleText}>{secureText ? 'Show' : 'Hide'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View
                                style={[styles.passwordRow, focusedField === 'confirmPassword' && styles.inputFocused]}
                            >
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    placeholderTextColor="#6b6b70"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    onFocus={() => setFocusedField('confirmPassword')}
                                    onBlur={() => setFocusedField(null)}
                                    secureTextEntry={secureConfirmText}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setSecureConfirmText(!secureConfirmText)}>
                                    <Text style={styles.toggleText}>{secureConfirmText ? 'Show' : 'Hide'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                        <TouchableOpacity
                            style={[styles.loginButton, (loading || !isValid) && styles.loginButtonDisabled]}
                            activeOpacity={0.85}
                            onPress={handleSubmit}
                            disabled={loading || !isValid}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.signUpRow}>
                            <Text style={styles.signUpText}>Already have an account? </Text>
                            <TouchableOpacity onPress={handleBackToLogin}>
                                <Text style={styles.signUpLink}>Log in</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Self-contained styles so this file works standalone. If your login screen's
// `styles` object is exported from a shared file, delete this block and
// import that one instead so both screens stay pixel-identical.
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#121214' },
    flex: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    card: {
        backgroundColor: '#1c1c1f',
        borderRadius: 16,
        padding: 24,
    },
    title: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#a0a0a5', marginBottom: 24 },
    fieldGroup: { marginBottom: 16 },
    label: { fontSize: 13, color: '#c7c7cc', marginBottom: 6 },
    input: {
        backgroundColor: '#2a2a2e',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#ffffff',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputFocused: { borderColor: ACCENT_BLUE },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2e',
        borderRadius: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    passwordInput: { flex: 1, paddingVertical: 12, color: '#ffffff' },
    toggleText: { color: ACCENT_BLUE, fontSize: 13, fontWeight: '600', paddingLeft: 12 },
    errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },
    loginButton: {
        backgroundColor: ACCENT_BLUE,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonDisabled: { opacity: 0.5 },
    loginButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    signUpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    signUpText: { color: '#a0a0a5', fontSize: 13 },
    signUpLink: { color: ACCENT_BLUE, fontSize: 13, fontWeight: '700' },
});