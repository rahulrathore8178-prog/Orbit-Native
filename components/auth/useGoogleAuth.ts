import { API_URL } from '@/lib/utils';
import { signIn } from '@/redux/slice/authSlice';
import { useAppDispatch } from '@/redux/store';
import { statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import Constants from 'expo-constants';

/**
 * Native Google sign-in (one tap, no browser redirect):
 *   Google sheet -> idToken -> POST /api/auth/google/mobile -> { token, user, profileComplete }
 *   - profileComplete !== false : signed in straight away
 *   - profileComplete === false : parked in memory, user finishes /complete-profile first
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
console.log('WEB_CLIENT_ID', WEB_CLIENT_ID);
// const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;
// const configure = () => {
//     if (configured) return;
//     GoogleSignin.configure({
//         webClientId: WEB_CLIENT_ID,
//         // iosClientId: IOS_CLIENT_ID,
//         scopes: ['profile', 'email'],
//     });
//     configured = true;
// };
// if (WEB_CLIENT_ID) configure(); // configure at import time so the first tap is instant

/* -- token for an account that signed in with Google but hasn't finished setup -- */
type Pending = { token: string; user: any } | null;
let pending: Pending = null;
export const setPendingAuth = (p: Pending) => { pending = p; };
export const getPendingAuth = () => pending;
export const clearPendingAuth = () => { pending = null; };

const isExpoGo =
    Constants.executionEnvironment === 'storeClient';

export function useGoogleAuth() {
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);

    const signInWithGoogle = useCallback(async () => {
        if (isExpoGo) {
            Alert.alert(
                'Google Sign-In',
                'Google Sign-In requires a Development Build and does not work in Expo Go.'
            );
            return;
        }

        const { GoogleSignin, statusCodes } = require(
            '@react-native-google-signin/google-signin'
        );

        if (inFlight.current) return;

        inFlight.current = true;
        setLoading(true);
        setError('');

        try {
            // configure();

            await GoogleSignin.hasPlayServices({
                showPlayServicesUpdateDialog: true,
            });

            const res: any = await GoogleSignin.signIn();
            if (res?.type === 'cancelled') return;

            const idToken = res?.data?.idToken ?? res?.idToken;
            if (!idToken) throw new Error('Google did not return a token. Please try again.');

            const { data } = await axios.post(
                `${API_URL}/api/auth/google/mobile`,
                { idToken },
                { timeout: 15000 },
            );
            if (!data?.token) throw new Error('Server did not return a session.');

            GoogleSignin.signOut().catch(() => { }); // so the account chooser shows next time

            if (data.profileComplete === false) {
                setPendingAuth({ token: data.token, user: data.user });
                router.replace('/complete-profile');
                return;
            }

            await dispatch(signIn({ token: data.token, user: data.user })).unwrap();
            DeviceEventEmitter.emit('auth:user-updated');
        } catch (e: any) {
            console.error('Google sign-in error', e);
            Alert.alert('Google Sign-In Error', e.message);
            if (e?.code === statusCodes.SIGN_IN_CANCELLED || e?.code === statusCodes.IN_PROGRESS) return;
            setError(
                e?.response?.data?.message ||
                (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
                    ? 'Google Play Services is not available on this device.'
                    : e?.message) ||
                'Google sign-in failed. Please try again.',
            );
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, [dispatch]);

    return { googleEnabled: Boolean(WEB_CLIENT_ID), loading, error, signInWithGoogle };
}
