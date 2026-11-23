import axios from 'axios';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { DeviceEventEmitter, Platform } from 'react-native';
import notifee, { AndroidImportance, AuthorizationStatus, EventType } from 'react-native-notify-kit';
import {
    getInitialNotification,
    getMessaging,
    getToken,
    onMessage,
    onNotificationOpenedApp,
    onTokenRefresh,
} from '@react-native-firebase/messaging';
import { API_URL } from '@/lib/utils';

const CHANNEL_ID = 'default'; // must match android.notification.channelId in the backend
const messaging = getMessaging();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureChannel() {
    if (Platform.OS !== 'android') return;
    await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'General',
        importance: AndroidImportance.HIGH,
        lightColor: '#6D8BFF',
    });
}

/** Reads the FCM token (both platforms). On iOS the APNs token can take a moment, so retry. */
async function readToken(): Promise<string | null> {
    if (Platform.OS === 'ios' && !Device.isDevice) {
        console.log('[push] skipped: iOS simulator');
        return null;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const token = await getToken(messaging);
            if (token) return token;
        } catch (e: any) {
            console.warn(`[push] getToken attempt ${attempt} failed:`, e?.message ?? e);
        }
        await sleep(1000);
    }
    return null;
}

async function getPushToken(askPermission: boolean): Promise<string | null> {
    await ensureChannel();
    const settings = askPermission ? await notifee.requestPermission() : await notifee.getNotificationSettings();
    const ok =
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
    if (!ok) {
        console.warn('[push] permission not granted. Enable it in the phone settings for Orbit.');
        return null;
    }
    return readToken();
}

async function postToken(token: string) {
    try {
        const res = await axios.post(
            `${API_URL}/api/auth/user/push-token`,
            { token, platform: Platform.OS },
            { timeout: 30000 },
        );
        console.log('[push] saved on server:', res.status);
    } catch (e: any) {
        console.warn('[push] FAILED saving on server:', e?.response?.status, e?.response?.data ?? e?.message);
    }
}

export async function registerPushToken() {
    const token = await getPushToken(true);
    if (!token) {
        console.warn('[push] register stopped: no token');
        return;
    }
    console.log('[push] FCM token obtained, length:', token.length);
    await postToken(token);
}

/** Call BEFORE clearing the session so the next person on this phone is not notified for you. */
export async function unregisterPushToken() {
    try {
        const token = await readToken(); // no permission needed just to read it
        if (!token) return;
        await axios.delete(`${API_URL}/api/auth/user/push-token`, { data: { token }, timeout: 8000 });
        console.log('[push] unregistered');
    } catch { /* best effort */ }
}

function openFromData(data?: Record<string, unknown>) {
    const url = data?.url;
    console.log('[push] open, url:', url);
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as any);
}

/** Foreground display, taps, token refresh. Returns an unsubscribe function. */
export function startFcmListeners() {
    const unsubs = [
        // Foreground: the OS does not show FCM messages here, so display it ourselves.
        onMessage(messaging, async (msg) => {
            DeviceEventEmitter.emit('notifications:received');
            await ensureChannel();
            await notifee.displayNotification({
                title: msg.notification?.title,
                body: msg.notification?.body,
                data: msg.data,
                android: {
                    channelId: CHANNEL_ID,
                    pressAction: { id: 'default', launchActivity: 'default' },
                },
                ios: {
                    sound: 'default',
                    foregroundPresentationOptions: { banner: true, list: true, sound: true },
                },
            });
        }),
        // Tap on an OS-displayed notification while the app was in the background.
        onNotificationOpenedApp(messaging, (msg) => openFromData(msg.data)),
        // FCM rotated the token.
        onTokenRefresh(messaging, (t) => { postToken(t); }),
        // Tap on a notification we displayed while the app was in the foreground.
        notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS) openFromData(detail.notification?.data);
        }),
    ];
    return () => unsubs.forEach((u) => u());
}

/** Cold start: the app was killed and opened by tapping a notification. */
export async function handleInitialNotification() {
    const fromFcm = await getInitialNotification(messaging);
    if (fromFcm) return openFromData(fromFcm.data);
    const fromKit = await notifee.getInitialNotification();
    if (fromKit) openFromData(fromKit.notification?.data);
}