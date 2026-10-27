import { API_URL } from '@/lib/utils';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// How a notification looks while the app is open.
// (On older SDKs, replace shouldShowBanner/shouldShowList with shouldShowAlert: true.)
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
    if (!Device.isDevice) return null; // emulators cannot receive pushes

    if (Platform.OS === 'android') {
        // The channel must exist before the permission prompt on Android 13+.
        await Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#6D8BFF',
        });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && askPermission) {
        status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const id = projectId();
    if (!id) {
        console.warn('[push] EAS projectId is missing');
        return null;
    }
    try {
        return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    } catch (e) {
        console.warn('[push] could not get token', e);
        return null;
    }
}

export async function registerPushToken() {
    const token = await getPushToken(true);
    if (!token) return;
    try {
        await axios.post(`${API_URL}/api/auth/user/push-token`, { token, platform: Platform.OS }, { timeout: 30000 });
    } catch (e) {
        console.warn('[push] register failed', e);
    }
}

/** Call BEFORE clearing the session so the next person on this phone is not notified for you. */
export async function unregisterPushToken() {
    try {
        const token = await getPushToken(false);
        if (!token) return;
        await axios.delete(`${API_URL}/api/auth/user/push-token`, { data: { token }, timeout: 8000 });
    } catch { /* best effort */ }
}