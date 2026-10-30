import { API_URL } from '@/lib/utils';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

async function getPushToken(askPermission: boolean): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('[push] 1 skipped: not a physical device');
        return null;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#6D8BFF',
        });
        console.log('[push] 1 channel ready');
    }

    let { status } = await Notifications.getPermissionsAsync();
    console.log('[push] 2 permission before:', status);
    if (status !== 'granted' && askPermission) {
        status = (await Notifications.requestPermissionsAsync()).status;
        console.log('[push] 2 permission after prompt:', status);
    }
    if (status !== 'granted') {
        console.warn('[push] 2 FAILED: permission not granted. Enable it in Settings > Apps > Orbit > Notifications');
        return null;
    }

    const id = projectId();
    console.log('[push] 3 projectId:', id, '| app package:', Constants.expoConfig?.android?.package);
    if (!id) {
        console.warn('[push] 3 FAILED: EAS projectId is missing');
        return null;
    }
    try {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
        console.log('[push] 4 token obtained:', token);
        return token;
    } catch (e: any) {
        console.warn('[push] 4 FAILED getting token:', e?.message ?? e);
        return null;
    }
}

export async function registerPushToken() {
    console.log('[push] register start, API:', API_URL);
    const token = await getPushToken(true);
    if (!token) {
        console.warn('[push] register stopped: no token');
        return;
    }
    try {
        const res = await axios.post(`${API_URL}/api/auth/user/push-token`, { token, platform: Platform.OS }, { timeout: 30000 });
        console.log('[push] 5 saved on server:', res.status, res.data);
    } catch (e: any) {
        console.warn('[push] 5 FAILED saving on server:', e?.response?.status, e?.response?.data ?? e?.message);
    }
}

/** Call BEFORE clearing the session so the next person on this phone is not notified for you. */
export async function unregisterPushToken() {
    try {
        const token = await getPushToken(false);
        if (!token) return;
        await axios.delete(`${API_URL}/api/auth/user/push-token`, { data: { token }, timeout: 8000 });
        console.log('[push] unregistered');
    } catch { /* best effort */ }
}