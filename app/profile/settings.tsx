import { authStorage } from '@/lib/auth/authStorage';
import { unregisterPushToken } from '@/lib/notifications/push';
import { API_URL } from '@/lib/utils';
import { signOut } from '@/redux/slice/authSlice';
import { setUserId } from '@/redux/slice/profileSlice';
import { useAppDispatch } from '@/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Archive, Bookmark, ChevronLeft, ChevronRight, LocateIcon, LogOut } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Switch,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GLASS = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const DANGER = '#f87171';

/* ---------- press feedback (runs on the UI thread) ---------- */

function usePressScale(to = 0.97) {
    const scale = useSharedValue(1);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
    return {
        style,
        onPressIn: () => scale.set(withTiming(to, { duration: 90 })),
        onPressOut: () => scale.set(withSpring(1, { damping: 16, stiffness: 260 })),
    };
}

/* ---------- pieces ---------- */

function BackButton({ onPress }: { onPress: () => void }) {
    const press = usePressScale(0.92);
    return (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ alignSelf: 'flex-start' }}
        >
            <Animated.View
                style={[
                    {
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: '#0b0b0c',
                        shadowColor: '#000',
                        shadowOffset: { width: 3, height: 3 },
                        shadowOpacity: 0.8,
                        shadowRadius: 6,
                        elevation: 6,
                    },
                    press.style,
                ]}
            >
                <LinearGradient
                    colors={['#1d1d1f', '#0b0b0c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        flex: 1,
                        borderRadius: 21,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                    }}
                >
                    <ChevronLeft size={20} color="#ffffff" />
                </LinearGradient>
            </Animated.View>
        </Pressable>
    );
}

function IconTile({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
    return (
        <LinearGradient
            colors={danger ? ['#2a1517', '#140a0b'] : ['#1d1d1f', '#0b0b0c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: danger ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.08)',
            }}
        >
            {children}
        </LinearGradient>
    );
}

type RowProps = {
    icon: React.ReactNode;
    label: string;
    hint?: string;
    onPress: () => void;
    destructive?: boolean;
    loading?: boolean;
};

function SettingsRow({ icon, label, hint, onPress, destructive, loading }: RowProps) {
    const press = usePressScale(0.98);
    return (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Animated.View style={press.style} className="flex-row items-center px-4 py-3.5">
                <IconTile danger={destructive}>{icon}</IconTile>
                <View className="ml-3.5 flex-1">
                    <Text
                        className="text-[15px] font-semibold"
                        style={{ color: destructive ? DANGER : '#ffffff' }}
                    >
                        {label}
                    </Text>
                    {hint ? <Text className="mt-0.5 text-xs text-neutral-500">{hint}</Text> : null}
                </View>
                {loading ? (
                    <ActivityIndicator size="small" color={destructive ? DANGER : '#a3a3a3'} />
                ) : destructive ? null : (
                    <ChevronRight size={18} color="#525252" />
                )}
            </Animated.View>
        </Pressable>
    );
}

function Group({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
    const items = React.Children.toArray(children);
    return (
        <Animated.View entering={FadeInDown.duration(380).delay(index * 70)} className="mb-6">
            <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[1.4px] text-neutral-500">
                {title}
            </Text>
            <View
                className="overflow-hidden rounded-3xl"
                style={{ backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER }}
            >
                {items.map((child, i) => (
                    <React.Fragment key={i}>
                        {i > 0 ? (
                            <View
                                style={{
                                    height: StyleSheet.hairlineWidth,
                                    marginLeft: 70,
                                    backgroundColor: BORDER,
                                }}
                            />
                        ) : null}
                        {child}
                    </React.Fragment>
                ))}
            </View>
        </Animated.View>
    );
}

/* ---------- screen ---------- */

const Settings = () => {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();
    const [loggingOut, setLoggingOut] = useState(false);
    const [discoverable, setDiscoverable] =
        useState(true);

    const [loadingDiscover, setLoadingDiscover] =
        useState(false);

    useEffect(() => {
        (async () => {
            try {
                const token = await authStorage.getToken();

                const { data } = await axios.get(
                    `${API_URL}/api/community/discover/preferences`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setDiscoverable(data.isDiscoverable);
            } catch (err) {
                console.log(err);
            }
        })();
    }, []);

    const toggleDiscoverability = async (
        value: boolean
    ) => {
        try {
            setLoadingDiscover(true);

            const token =
                await authStorage.getToken();

            await axios.patch(
                `${API_URL}/api/community/discover/preferences`,
                {
                    enabled: value,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setDiscoverable(value);
        } catch (error) {
            console.error(
                "toggle discoverability failed",
                error
            );
        } finally {
            setLoadingDiscover(false);
        }
    };

    const handleLogout = useCallback(async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            const token = await authStorage.getToken();
            try {
                await axios.get(`${API_URL}/api/auth/user/logout`, {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 8000, // don't hang logout if Render is asleep
                });
            } catch (error) {
                // Continue local cleanup even if the API request fails.
                console.warn('logout request failed', error);
            }

            dispatch(setUserId(null));
            DeviceEventEmitter.emit('auth:user-updated');

            // Clears storage and flips auth.status to 'signedOut'; the guard redirects to login.
            await unregisterPushToken();
            await dispatch(signOut()).unwrap();
        } finally {
            setLoggingOut(false);
        }
    }, [dispatch, loggingOut]);

    return (
        <View style={{ flex: 1, paddingTop: insets.top + 8 }} className="flex-1 bg-black">
            <View className="px-4">
                <BackButton onPress={() => router.push('/(tabs)/profile')} />
            </View>

            <Animated.View entering={FadeInDown.duration(350)} className="px-5 pb-6 pt-5">
                <Text className="text-[30px] font-bold text-white">Settings</Text>
                <Text className="mt-1 text-sm text-neutral-500">Manage your account and session</Text>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
            >
                <Group title="Privacy" index={3}>
                    <View
                        className="flex-row items-center justify-between rounded-2xl bg-neutral-900 px-4 py-4"
                    >
                        <View className="flex-1">
                            <Text className="text-white font-semibold">
                                Discover Nearby
                            </Text>

                            <Text className="text-neutral-400 text-sm mt-1">
                                Allow other people nearby to find you.
                            </Text>
                        </View>

                        <Switch
                            value={discoverable}
                            disabled={loadingDiscover}
                            onValueChange={
                                toggleDiscoverability
                            }
                        />
                    </View>
                </Group>
                <Group title="Library" index={1}>
                    <SettingsRow
                        icon={<Bookmark size={18} color="#e5e5e5" />}
                        label="Saved Posts"
                        hint="Posts you've bookmarked"
                        onPress={() => router.push('/profile/savedPosts')}
                    />
                </Group>

                <Group title="Archived" index={1}>
                    <SettingsRow
                        icon={<Archive size={18} color="#e5e5e5" />}
                        label="Archived Posts"
                        hint="Posts you've archived"
                        onPress={() => router.push('/profile/savedPosts/archivedPosts')}
                    />
                </Group>

                <Group title="Session" index={2}>
                    <SettingsRow
                        icon={<LogOut size={18} color={DANGER} />}
                        label="Logout"
                        hint="Sign out of this device"
                        destructive
                        loading={loggingOut}
                        onPress={handleLogout}
                    />
                </Group>
            </ScrollView>
        </View>
    );
};

export default Settings;