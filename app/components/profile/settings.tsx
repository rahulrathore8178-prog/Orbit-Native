import { API_URL } from '@/app/(tabs)/home';
import { setUserId } from '@/redux/slice/profileSlice';
import { useAppDispatch } from '@/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { DeviceEventEmitter, Platform, Pressable, Text, View } from 'react-native';

const Settings = () => {
    const dispatch = useAppDispatch();

    const handleLogout = async () => {
        const token = await AsyncStorage.getItem('token');
        try {
            await axios.get(`${API_URL}/api/auth/user/logout`, {
                withCredentials: true,
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (error) {
            // Continue local cleanup even if API request fails.
            console.error('logout error', error);
        }

        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        dispatch(setUserId(null));

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:user-updated'));
        } else {
            DeviceEventEmitter.emit('auth:user-updated');
        }

        router.replace('/');
    };

    return (
        <View style={{ flex: 1 }} className="flex-1 bg-black pt-14">
            <Text className="text-white text-2xl font-bold px-5 pb-4">Settings</Text>
            <Pressable
                onPress={handleLogout}
                className="flex-row text-white bg-red-800 rounded-full items-center gap-3 px-5 py-3 active:bg-neutral-900"
            >
                <Text className="text-white font-semibold">Logout</Text>
            </Pressable>
        </View>
    )
};

export default Settings