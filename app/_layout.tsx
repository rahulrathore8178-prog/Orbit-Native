import '@/global.css';
import { useEffect, useRef } from 'react';
import { View, DeviceEventEmitter } from 'react-native';
import { Stack, ThemeProvider, DarkTheme, useRouter, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { registerPushToken } from '@/lib/notifications/push';
import * as Notifications from 'expo-notifications';

import { store as reduxStore } from '@/redux/store'; // adjust to your store path
import { bootstrapAuth, signOut } from '@/redux/slice/authSlice';
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

SplashScreen.preventAutoHideAsync();
setupAxios(); // interceptors installed once, before any screen makes a request

function AuthGate() {
  // Swap `any` for your typed hooks (AppDispatch / RootState) if you have them.
  const dispatch = useDispatch<any>();
  const status = useSelector((s: any) => s.auth.status);
  // Needed by the quick-share overlay so it can exclude you from your own friend list.
  // If your auth slice stores the user elsewhere, adjust this selector.
  const currentUserId = useSelector((s: any) => s.auth.user?._id ?? s.auth.user?.id);

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
    setUnauthorizedHandler(() => {
      if (reduxStore.getState().auth.status === 'signedIn') dispatch(signOut());
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

  // 1) Register this phone for pushes once signed in (small delay so the home screen settles first).
useEffect(() => {
  if (status !== 'signedIn') return;
  const t = setTimeout(() => { registerPushToken(); }, 1500);
  return () => clearTimeout(t);
}, [status]);

// 2) Tell the app a push arrived while it is open (refresh badges/unread counts).
useEffect(() => {
  const sub = Notifications.addNotificationReceivedListener(() => {
    DeviceEventEmitter.emit('notifications:received');
  });
  return () => sub.remove();
}, []);

// 3) Tapping a notification opens the screen in data.url. Also works from a cold start.
const lastResponse = Notifications.useLastNotificationResponse();
const handledId = useRef<string | null>(null);
useEffect(() => {
  if (status !== 'signedIn' || !lastResponse) return;
  const id = lastResponse.notification.request.identifier;
  if (handledId.current === id) return;
  handledId.current = id;
  const url = lastResponse.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as any);
}, [lastResponse, status]);

  return (
    // Calls: realtime socket + WebRTC live here so an incoming call can ring on any screen.
    <CallProvider apiUrl={API_URL} userId={isSignedIn ? currentUserId : null}>
      {/* The navigator is ALWAYS mounted. In SDK 58 the router builds its state from the
          launch URL ('/'), so it needs a navigator to exist on the first render. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn} redirectTo="/">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>

        {/* complete-profile is signed-out only: once signIn() succeeds the guard
      redirects to /home automatically. */}
        <Stack.Protected guard={!isSignedIn} redirectTo="/home">
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>

      {/* Quick-share overlay (hold-and-pan friend list + "Shared" toast).
          Mounted once, signed-in only, above the navigator. It ignores touches (pointerEvents none). */}
      {isSignedIn ? <ShareQuickHost currentUserId={currentUserId} /> : null}
      {isSignedIn ? <IncomingChatToaster /> : null}

      {/* Full-screen incoming / outgoing / active call UI, above everything else. */}
      {isSignedIn ? <CallHost /> : null}
      {isSignedIn ? <NotificationExpandHost /> : null}

      {/* Loader sits on top instead of replacing the navigator. */}
      {status === 'loading' ? (
        <View className="absolute inset-0 bg-black">
          <OrbitLoader />
        </View>
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