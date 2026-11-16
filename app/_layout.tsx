import '@/global.css';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, ThemeProvider, DarkTheme, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { handleInitialNotification, registerPushToken, startFcmListeners } from '@/lib/notifications/push';

import { store as reduxStore } from '@/redux/store'; // adjust to your store path
import { bootstrapAuth, cancelAddingAccount, removeAccount, switchSettled } from '@/redux/slice/authSlice';
import { setupAxios, setUnauthorizedHandler } from '@/lib/auth/setupAxios';
import OrbitLoader from '@/components/ui/OrbitLoader'; // adjust to your loader path
import { ShareQuickHost } from '@/components/postCard/ShareQuick'; // TODO: adjust to the folder where ShareSheet.tsx lives
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { COLORS } from '@/constants/capsule/constants';
import * as SystemUI from 'expo-system-ui';
import { CallProvider } from '@/lib/calls/callProvider';
import { CallHost } from '@/components/calls/CallHost';
import { API_URL } from '@/lib/utils';
import { IncomingChatToaster } from '@/components/chats/IncomingChatToaster';
import { NotificationExpandHost } from '@/components/notification/NotificationExpand';
import '@/components/services/installFailover';
import { AccountSwitcherHost } from '@/components/auth/AccountSwitcher';
import Animated, { FadeOut, FadeIn } from 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();
setupAxios(); // interceptors installed once, before any screen makes a request

function AuthGate() {
  const dispatch = useDispatch<any>();
  const status = useSelector((s: any) => s.auth.status);
  const activeAccountId = useSelector((s: any) => s.auth.activeAccountId);
  const currentUserId = useSelector((s: any) => s.auth.user?._id ?? s.auth.user?.id);
  const addingAccount = useSelector((s: any) => s.auth.addingAccount);

  // 1) Decide signedIn / signedOut once on start.
  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  // Keep the native splash up until we know the auth state.
  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  // 2) Any 401 from your API while signed in = session expired -> log out cleanly.
  useEffect(() => {
    setUnauthorizedHandler((accountId) => {
      const { status: st, activeAccountId } = reduxStore.getState().auth;
      if (st !== 'signedIn') return;
      const id = accountId ?? activeAccountId;
      if (id) dispatch(removeAccount(id)); // only the account whose token was rejected
    });
    return () => setUnauthorizedHandler(null);
  }, [dispatch]);

  const isSignedIn = status === 'signedIn';
  const router = useRouter();
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current === 'signedIn' && status === 'signedOut') {
      // Drop every leftover unguarded screen (settings, profile/*) and land on login.
      try { router.dismissAll(); } catch { /* nothing to dismiss */ }
      router.replace('/');
    }
    prevStatus.current = status;
  }, [status, router]);

  // Account switch: let the loader show briefly, then settle.
  useEffect(() => {
    if (status !== 'switching') return;
    const t = setTimeout(() => dispatch(switchSettled()), 250);
    return () => clearTimeout(t);
  }, [status, dispatch]);

  // Push, step 1: register this phone's FCM token once signed in, and again after
  // an account switch (activeAccountId changes) so the new account owns the token.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const t = setTimeout(() => { registerPushToken(); }, 1500);
    return () => clearTimeout(t);
  }, [status, activeAccountId]);

  // Push, step 2: foreground display, notification taps, token refresh.
  useEffect(() => {
    if (status !== 'signedIn') return;
    return startFcmListeners();
  }, [status, activeAccountId]);

  // Push, step 3: app was killed and opened by tapping a notification.
  const coldHandled = useRef(false);
  useEffect(() => {
    if (status !== 'signedIn' || coldHandled.current) return;
    coldHandled.current = true;
    handleInitialNotification();
  }, [status]);

  // Add-account mode: open the login screen once, and end the mode if the user backs out to the app.
  const pathname = usePathname();
  const addNav = useRef<'idle' | 'pushed'>('idle');
  useEffect(() => {
    const AUTH_PATHS = ['/', '/signup', '/complete-profile', '/forgot-password', '/ForgotPassword'];
    if (!addingAccount) { addNav.current = 'idle'; return; }
    if (addNav.current === 'idle') { addNav.current = 'pushed'; router.push('/'); return; }
    if (!AUTH_PATHS.includes(pathname)) dispatch(cancelAddingAccount());
  }, [addingAccount, pathname, dispatch]);

  return (
    // Calls: realtime socket + WebRTC live here so an incoming call can ring on any screen.
    <CallProvider apiUrl={API_URL} userId={isSignedIn ? currentUserId : null}>
      {/* The navigator is ALWAYS mounted. In SDK 58 the router builds its state from the
          launch URL ('/'), so it needs a navigator to exist on the first render. */}
      <Stack key={activeAccountId ?? 'signed-out'} screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn} redirectTo="/">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>

        {/* complete-profile is signed-out only: once signIn() succeeds the guard
      redirects to /home automatically. */}
        <Stack.Protected guard={!isSignedIn || addingAccount} redirectTo="/home">
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>

      {isSignedIn ? <ShareQuickHost currentUserId={currentUserId} /> : null}
      {isSignedIn ? <IncomingChatToaster /> : null}
      {isSignedIn ? <AccountSwitcherHost /> : null}

      {isSignedIn ? <CallHost /> : null}
      {isSignedIn ? <NotificationExpandHost /> : null}

      {/* Loader sits on top instead of replacing the navigator. */}
      {status === 'loading' || status === 'switching' ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(320)}
          className="absolute inset-0 bg-black"
        >
          <OrbitLoader />
        </Animated.View>
      ) : null}
    </CallProvider>
  );
}

const BG = COLORS.bg;
SystemUI.setBackgroundColorAsync(BG);

const OrbitTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: BG, card: BG },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
      <Provider store={reduxStore}>
        <ThemeProvider value={OrbitTheme}>
          <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
            <AuthGate />
          </KeyboardProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}