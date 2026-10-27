import {
    C, enter, ErrorBanner, GlassCard, OrbitBackdrop, OrbitInput, OrbitRings, PrimaryButton, StrengthMeter,
} from '@/components/auth/OrbitAuth';
import { clearPendingAuth, getPendingAuth } from '@/components/auth/useGoogleAuth';
import { signIn, userUpdated } from '@/redux/slice/authSlice';
import { useAppDispatch } from '@/redux/store';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, StatusBar, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../lib/utils';
import { authStorage } from '@/lib/auth/authStorage';
import * as M from 'expo-image-manipulator';

const BIO_MAX = 150;
const AVATAR = 112;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

type Pic = { uri: string; name: string; type: string };

const AVATAR_PX = 720;

// Shrinks to ~720px JPEG before upload. Returns null when the native module isn't in this build.
async function shrinkAvatar(uri: string, width?: number): Promise<Pic | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const needsResize = !width || width > AVATAR_PX;
        let out: { uri: string };
        if (M.ImageManipulator?.manipulate) {
            const ctx = M.ImageManipulator.manipulate(uri);
            if (needsResize) ctx.resize({ width: AVATAR_PX });
            const img = await ctx.renderAsync();
            out = await img.saveAsync({ format: M.SaveFormat.JPEG, compress: 0.72 });
        } else {
            out = await M.manipulateAsync(uri, needsResize ? [{ resize: { width: AVATAR_PX } }] : [], {
                format: M.SaveFormat.JPEG,
                compress: 0.72,
            });
        }
        return { uri: out.uri, name: 'avatar.jpg', type: 'image/jpeg' };
    } catch {
        return null;
    }
}

async function uploadAvatar(token: string, pic: Pic) {
    const fd = new FormData();
    fd.append('profilePic', { uri: pic.uri, name: pic.name, type: pic.type } as any);
    const res = await axios.patch(`${API_URL}/api/auth/user/profile/image`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
    });
    return res.data?.user ?? null;
}

export default function CompleteProfileScreen() {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();

    const [session] = useState(getPendingAuth);
    const [email, setEmail] = useState<string>(session?.user?.email ?? '');
    const [pic, setPic] = useState<Pic | null>(null);
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const bioRef = useRef<TextInput>(null);
    const passRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    useEffect(() => {
        if (!session) {
            router.replace('/');
            return;
        }
        if (session.user?.email) return;
        let alive = true;
        axios
            .get(`${API_URL}/api/auth/user/me`, { headers: { Authorization: `Bearer ${session.token}` } })
            .then((r) => { if (alive && r.data?.user?.email) setEmail(r.data.user.email); })
            .catch(() => { if (alive) setErrorMsg('Could not load your Google account details.'); });
        return () => { alive = false; };
    }, [session]);

    const press = useSharedValue(1);
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

    const pickPhoto = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];

        // Shrink the photo before it is ever uploaded.
        const small = await shrinkAvatar(a.uri, a.width);
        if (small) {
            setPic(small);
            return;
        }

        // Fallback if the native module is not in this build yet; the server shrinks it anyway.
        const ext = (a.uri.split('.').pop() || 'jpg').toLowerCase();
        setPic({ uri: a.uri, name: `avatar.${ext}`, type: a.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    }, []);

    const [uState, setUState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
    const uname = username.trim();
    const usernameBad = uname.length > 0 && !USERNAME_RE.test(uname);
    const mismatch = confirm.length > 0 && password !== confirm;
    const isValid = USERNAME_RE.test(uname) && uState !== 'taken' && uState !== 'checking' && password.length >= 6 && password === confirm;

    useEffect(() => {
        if (!USERNAME_RE.test(uname)) { setUState('idle'); return; }
        setUState('checking');
        const ctl = new AbortController();
        const t = setTimeout(async () => {
            try {
                const { data } = await axios.get(`${API_URL}/api/auth/username/available`, {
                    params: { u: uname }, signal: ctl.signal, timeout: 15000,
                });
                setUState(data?.available ? 'ok' : 'taken');
            } catch (e) {
                if (!axios.isCancel(e)) setUState('idle'); // the server still checks on submit
            }
        }, 450);
        return () => { clearTimeout(t); ctl.abort(); };
    }, [uname]);



    const handleSubmit = useCallback(async () => {
        if (!session || !isValid || loading) return;
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await axios.patch(
                `${API_URL}/api/auth/complete-profile`,
                { username: uname, password, ...(bio.trim() ? { bio: bio.trim() } : {}) },
                { headers: { Authorization: `Bearer ${session.token}` }, timeout: 60000 },
            );

            const token = session.token;
            const photo = pic;

            // Flipping auth to signedIn makes the guard in _layout redirect to /home.
            await dispatch(signIn({ token, user: res.data?.user ?? session.user })).unwrap();
            clearPendingAuth();
            DeviceEventEmitter.emit('auth:user-updated');

            // Best effort: a slow or failed photo never blocks the account.
            if (photo) {
                await uploadAvatar(token, photo)
                    .then(async (u) => {
                        if (!u) return;
                        await authStorage.setUser(u);   // keeps useCurrentUser and bootstrapAuth in sync
                        dispatch(userUpdated(u));
                        DeviceEventEmitter.emit('auth:user-updated');
                    })
                    .catch(() => {
                        Alert.alert(
                            'Photo not saved',
                            'Your account is ready, but we could not upload your photo. You can add it from your profile.',
                        );
                    });
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
            setLoading(false);
        }
    }, [session, isValid, loading, uname, password, bio, pic, dispatch]);

    const switchAccount = useCallback(() => {
        clearPendingAuth();
        router.replace('/');
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <StatusBar barStyle="light-content" />
            <OrbitBackdrop />

            <KeyboardAwareScrollView
                bottomOffset={24}
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
                <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center' }}>
                    <OrbitRings size={228}>
                        <Animated.View style={pressStyle}>
                            <Pressable
                                onPress={pickPhoto}
                                onPressIn={() => { press.value = withSpring(0.95, { damping: 14, stiffness: 300 }); }}
                                onPressOut={() => { press.value = withSpring(1, { damping: 10, stiffness: 240 }); }}
                                accessibilityLabel="Choose profile photo"
                                style={{ width: AVATAR, height: AVATAR }}
                            >
                                <View
                                    style={{
                                        width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden',
                                        backgroundColor: C.field, borderWidth: 1.5, borderColor: 'rgba(109,139,255,0.7)',
                                        alignItems: 'center', justifyContent: 'center',
                                        shadowColor: C.accent, shadowOpacity: 0.55, shadowRadius: 20,
                                        shadowOffset: { width: 0, height: 0 }, elevation: 10,
                                    }}
                                >
                                    {pic ? (
                                        <Image source={{ uri: pic.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                                    ) : (
                                        <Ionicons name="person" size={46} color="rgba(255,255,255,0.35)" />
                                    )}
                                </View>
                                <LinearGradient
                                    colors={[C.accent, C.accent2]}
                                    style={{
                                        position: 'absolute', right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17,
                                        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg,
                                    }}
                                >
                                    <Ionicons name={pic ? 'swap-horizontal' : 'camera'} size={16} color="#fff" />
                                </LinearGradient>
                            </Pressable>
                        </Animated.View>
                    </OrbitRings>

                    <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>Almost in orbit</Text>
                    <Text style={{ color: C.mute, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                        {pic ? 'Looking good. Now finish your profile.' : 'Add a photo (optional) and finish your profile.'}
                    </Text>
                </Animated.View>

                <Animated.View entering={enter(1)} style={{ marginTop: 18 }}>
                    <GlassCard>
                        {email ? (
                            <View
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                                    backgroundColor: 'rgba(110,231,183,0.08)', borderWidth: 1,
                                    borderColor: 'rgba(110,231,183,0.22)', marginBottom: 16,
                                }}
                            >
                                <Ionicons name="checkmark-circle" size={15} color={C.ok} />
                                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{email}</Text>
                            </View>
                        ) : null}

                        <ErrorBanner message={errorMsg} />

                        <View style={{ gap: 14 }}>
                            <View>
                                <OrbitInput
                                    label="Username"
                                    icon="at-outline"
                                    value={username}
                                    onChangeText={setUsername}
                                    error={usernameBad || uState === 'taken'}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="username-new"
                                    maxLength={20}
                                    returnKeyType="next"
                                    onSubmitEditing={() => bioRef.current?.focus()}
                                    submitBehavior="submit"
                                />
                                {usernameBad ? (
                                    <Text style={{ color: C.danger, fontSize: 12.5, marginTop: 6, paddingHorizontal: 2 }}>
                                        3-20 characters: letters, numbers, _ or .
                                    </Text>
                                ) : uState === 'checking' ? (
                                    <Animated.Text entering={FadeIn} style={{ color: C.dim, fontSize: 12.5, marginTop: 6, paddingHorizontal: 2 }}>
                                        Checking availability…
                                    </Animated.Text>
                                ) : uState === 'ok' ? (
                                    <Animated.Text entering={FadeIn} style={{ color: C.ok, fontSize: 12.5, marginTop: 6, paddingHorizontal: 2 }}>
                                        @{uname} is available
                                    </Animated.Text>
                                ) : uState === 'taken' ? (
                                    <Animated.Text entering={FadeIn} style={{ color: C.danger, fontSize: 12.5, marginTop: 6, paddingHorizontal: 2 }}>
                                        That username is taken
                                    </Animated.Text>
                                ) : null}
                            </View>

                            <View>
                                <OrbitInput
                                    ref={bioRef}
                                    label="Bio (optional)"
                                    icon="create-outline"
                                    value={bio}
                                    onChangeText={setBio}
                                    multiline
                                    maxLength={BIO_MAX}
                                />
                                <Text
                                    style={{
                                        alignSelf: 'flex-end', marginTop: 6, marginRight: 4,
                                        color: bio.length >= BIO_MAX ? C.danger : C.dim, fontSize: 11.5,
                                    }}
                                >
                                    {bio.length}/{BIO_MAX}
                                </Text>
                            </View>

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
                                onSubmitEditing={handleSubmit}
                            />
                            {mismatch ? (
                                <Text style={{ color: C.danger, fontSize: 12.5, marginTop: -6, paddingHorizontal: 2 }}>
                                    Passwords do not match.
                                </Text>
                            ) : null}
                        </View>

                        <View style={{ height: 20 }} />
                        <PrimaryButton title="Launch into Orbit" onPress={handleSubmit} loading={loading} disabled={!isValid} />
                    </GlassCard>
                </Animated.View>

                <Animated.View entering={enter(2)} style={{ alignItems: 'center', marginTop: 20 }}>
                    <Pressable onPress={switchAccount} hitSlop={10}>
                        <Text style={{ color: C.mute, fontSize: 13.5 }}>
                            Not you? <Text style={{ color: '#9DB2FF', fontWeight: '700' }}>Use a different account</Text>
                        </Text>
                    </Pressable>
                </Animated.View>
            </KeyboardAwareScrollView>
        </View>
    );
}