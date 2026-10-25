import { authStorage } from '@/lib/auth/authStorage';
import { API_URL } from '@/lib/utils';
import { setUserId } from '@/redux/slice/profileSlice';
import { useAppDispatch } from '@/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { DeviceEventEmitter, Platform, Pressable, Text, View } from 'react-native';

const Settings = () => {
    const dispatch = useAppDispatch();

    const handleLogout = async () => {
        const token = await authStorage.getToken();
        console.log('[logout] token', token);
        try {
            await axios.get(`${API_URL}/api/auth/user/logout`, {
                withCredentials: true,
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log('[logout] API_URL', API_URL);
            console.log('[logout] logout request sent successfully');
        } catch (error) {
            // Continue local cleanup even if API request fails.
            console.error('logout error', error);
        }

        await authStorage.clear();
        await AsyncStorage.removeItem('user');
        dispatch(setUserId(null));

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:user-updated'));
        } else {
            DeviceEventEmitter.emit('auth:user-updated');
        };

        console.log('[logout] user logged out and redirected to login screen');
    };

    return (
        <View style={{ flex: 1 }} className="flex-1 bg-black pt-14">
            <View className="flex-row items-center just px-4 py-3">
                <Pressable
                    onPress={() => router.push('/(tabs)/profile')}
                    hitSlop={8}
                    className="h-9 w-9 items-center justify-center bottom-1 rounded-full bg-white/5 active:bg-white/10"
                >
                    <ChevronLeft size={20} color="#ffffff" />
                </Pressable>
                <Text className="text-white text-2xl font-bold px-5 pb-4">Settings</Text>
            </View>
            <Pressable
                onPress={handleLogout}
                className="flex-row text-white bg-red-800 rounded-full items-center gap-3 px-5 py-3 active:bg-neutral-900"
            >
                <Text className="text-white font-semibold">Logout</Text>
            </Pressable>
            <Pressable
                onPress={() => router.push('/profile/savedPosts')}
                className="flex-row text-white bg-gray-800 rounded-full items-center gap-3 px-5 py-3 active:bg-neutral-900"
            >
                <Text className="text-white font-semibold">Saved Posts</Text>
            </Pressable>
        </View>
    )
};

export default Settings