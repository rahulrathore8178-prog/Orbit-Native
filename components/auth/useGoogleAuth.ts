import { API_URL } from '@/lib/utils';
import { signIn } from '@/redux/slice/authSlice';
import { useAppDispatch } from '@/redux/store';
import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

/**
 * Native Google sign-in (one tap, no browser redirect):
 *   Google sheet -> idToken -> POST /api/auth/google/mobile -> { token, user, profileComplete }
 *   - profileComplete !== false : signed in straight away
 *   - profileComplete === false : parked in memory, user finishes /complete-profile first
 *
 * IMPORTANT: never import '@react-native-google-signin/google-signin' at the top of this file.
 * The native module does not exist in Expo Go, and a top-level import crashes the whole screen there.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/* -- token for an account that signed in with Google but hasn't finished setup -- */
type Pending = { token: string; user: any } | null;
let pending: Pending = null;
export const setPendingAuth = (p: Pending) => { pending = p; };
export const getPendingAuth = () => pending;
export const clearPendingAuth = () => { pending = null; };

// Lazy-load the native module and configure it exactly once, right before first use.
// This is what fixes "apiClient is null - call configure() first".
let configured = false;
function getGoogle() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-google-signin/google-signin');
    if (!configured) {
        if (!WEB_CLIENT_ID) {
            throw new Error('Google sign-in is not configured in this build (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).');
        }
        mod.GoogleSignin.configure({
            webClientId: WEB_CLIENT_ID,
            scopes: ['profile', 'email'],
            offlineAccess: false,
        });
        configured = true;
    }
    return mod as { GoogleSignin: any; statusCodes: any };
}

export function useGoogleAuth() {
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);

    const signInWithGoogle = useCallback(async () => {
        if (inFlight.current) return;

        if (isExpoGo) {
            setError('Google sign-in needs a development build and cannot run in Expo Go. Use email for now.');
            return;
        }

        inFlight.current = true;
        setLoading(true);
        setError('');

        let statusCodes: any = {};
        try {
            const google = getGoogle();
            statusCodes = google.statusCodes;
            const { GoogleSignin } = google;

            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            await GoogleSignin.signOut().catch(() => { }); // always show the account chooser

            const res: any = await GoogleSignin.signIn();
            if (res?.type === 'cancelled') return;

            const idToken = res?.data?.idToken ?? res?.idToken;
            if (!idToken) throw new Error('Google did not return a token. Please try again.');

            const { data } = await axios.post(
                `${API_URL}/api/auth/google/mobile`, // must match your router path exactly
                { idToken },
                { timeout: 20000 },
            );
            if (!data?.token) throw new Error('Server did not return a session.');

            if (data.profileComplete === false) {
                setPendingAuth({ token: data.token, user: data.user });
                router.replace('/complete-profile');
                return;
            }

            await dispatch(signIn({ token: data.token, user: data.user })).unwrap();
            DeviceEventEmitter.emit('auth:user-updated');
        } catch (e: any) {
            const code = e?.code;
            // Only treat as "cancelled" when we really have a code to compare.
            if (code != null && (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS)) return;

            console.warn('Google sign-in error', code, e?.message);
            let msg: string;
            if (e?.response?.data?.message) msg = e.response.data.message;
            else if (axios.isAxiosError(e) && !e.response) msg = 'Network error. Check your connection and try again.';
            else if (code != null && code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) msg = 'Google Play Services is not available on this device.';
            else if (String(code) === '10' || /DEVELOPER_ERROR/i.test(String(e?.message)))
                msg = "Google config error: this build's SHA-1 / package name is not registered on your Android OAuth client.";
            else msg = e?.message || 'Google sign-in failed. Please try again.';
            setError(msg);
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, [dispatch]);

    return { googleEnabled: Boolean(WEB_CLIENT_ID), loading, error, signInWithGoogle };
}