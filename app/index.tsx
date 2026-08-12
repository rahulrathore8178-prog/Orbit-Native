import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// TODO: point this at your backend (e.g. via react-native-config, app.json "extra", or an env file)
const API_URL = 'http://10.36.40.37:5000';

type FocusedField = 'emailOrUsername' | 'password' | null;

export default function LoginScreen() {
    // Use expo-router for navigation in this app
    // const router = useRouter();

    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [secureText, setSecureText] = useState(true);
    const [focusedField, setFocusedField] = useState<FocusedField>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [checkingAuth, setCheckingAuth] = useState(true);

    // --- Very small mount animation (fade + slide up) using RN's built-in Animated API ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    // On mount, check for an existing token and redirect to tabs if present
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (mounted && token) {
                    router.replace('/home');
                    return;
                }
            } catch (e) {
                // ignore and show login
                console.warn('Error checking stored token', e);
            } finally {
                if (mounted) setCheckingAuth(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [router]);

    const handleLogin = async () => {
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await axios.post(
                `${API_URL}/api/auth/user/login`,
                { emailOrUsername, password },
                {
                    // NOTE: withCredentials relies on a browser cookie jar, which native doesn't have.
                    // If your backend sets an auth cookie on login, it won't persist here automatically —
                    // prefer returning a token (as below) or use @react-native-cookies/cookies.
                    withCredentials: true,
                }
            );
            // No `window` on native — DeviceEventEmitter stands in for the browser's
            // custom-event broadcast. (For anything bigger, Context/Zustand/Redux is more idiomatic.)
                        DeviceEventEmitter.emit('auth:user-updated');
                        console.log('clicked login')
                        console.log('Login successful:', res.data);

                        // persist token for subsequent API calls
                        if (res.data?.token) {
                            await AsyncStorage.setItem('token', res.data.token);
                        }

                        setLoading(false);
                        router.replace('/home');
        } catch (err: any) {
            setErrorMsg(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Login failed. Please check your credentials.'
            );
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        // TODO: navigate to your "forgot password" flow
    };

    if (checkingAuth) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="#121214" />
                <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center' }]}> 
                    <ActivityIndicator size="large" color={ACCENT_BLUE} />
                </View>
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#121214" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Text style={styles.title}>Welcome to ORBI8</Text>
                        <Text style={styles.subtitle}>Log or Sign-up in to continue</Text>

                        {/* Email or Username */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email or Username</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    focusedField === 'emailOrUsername' && styles.inputFocused,
                                ]}
                                placeholder="you@example.com"
                                placeholderTextColor="#6b6b70"
                                value={emailOrUsername}
                                onChangeText={setEmailOrUsername}
                                onFocus={() => setFocusedField('emailOrUsername')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View
                                style={[
                                    styles.passwordRow,
                                    focusedField === 'password' && styles.inputFocused,
                                ]}
                            >
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
                                    <Text style={styles.toggleText}>
                                        {secureText ? 'Show' : 'Hide'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Error message */}
                        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                        {/* Forgot password */}
                        <TouchableOpacity
                            style={styles.forgotWrap}
                            onPress={handleForgotPassword}
                        >
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </TouchableOpacity>

                        {/* Login button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            activeOpacity={0.85}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Log In</Text>
                            )}
                        </TouchableOpacity>

                        {/* Sign up row */}
                        <View style={styles.signUpRow}>
                            <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/singup')}>
                                <Text style={styles.signUpLink}>Sign up</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const ACCENT_BLUE = '#3E82F7';

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#121214',
    },
    flex: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: '#1c1c1f',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2a2a2e',
        padding: 24,
    },
    title: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        color: '#9a9aa0',
        fontSize: 14,
        marginBottom: 28,
    },
    fieldGroup: {
        marginBottom: 18,
    },
    label: {
        color: '#c4c4c9',
        fontSize: 13,
        marginBottom: 6,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#232326',
        borderWidth: 1,
        borderColor: '#33333a',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#ffffff',
        fontSize: 15,
    },
    inputFocused: {
        borderColor: ACCENT_BLUE,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#232326',
        borderWidth: 1,
        borderColor: '#33333a',
        borderRadius: 10,
        paddingHorizontal: 14,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 12,
        color: '#ffffff',
        fontSize: 15,
    },
    toggleText: {
        color: ACCENT_BLUE,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 10,
    },
    errorText: {
        color: '#f16b6b',
        fontSize: 13,
        marginBottom: 14,
    },
    forgotWrap: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotText: {
        color: '#9a9aa0',
        fontSize: 13,
    },
    loginButton: {
        backgroundColor: ACCENT_BLUE,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        minHeight: 48,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    signUpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    signUpText: {
        color: '#9a9aa0',
        fontSize: 13,
    },
    signUpLink: {
        color: ACCENT_BLUE,
        fontSize: 13,
        fontWeight: '700',
    },
});