import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch, useSelector } from 'react-redux';

import { store as reduxStore } from '@/redux/store'; // adjust to your store path
import { bootstrapAuth, signOut } from '@/redux/slice/authSlice';
import { setupAxios, setUnauthorizedHandler } from '@/lib/auth/setupAxios';
import OrbitLoader from '@/components/ui/OrbitLoader'; // adjust to your loader path
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { COLORS } from '@/constants/capsule/constants';
import * as SystemUI from 'expo-system-ui';

SplashScreen.preventAutoHideAsync();
setupAxios(); // interceptors installed once, before any screen makes a request

function AuthGate() {
  // Swap `any` for your typed hooks (AppDispatch / RootState) if you have them.
  const dispatch = useDispatch<any>();
  const status = useSelector((s: any) => s.auth.status);

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

  return (
    <>
      {/* The navigator is ALWAYS mounted. In SDK 58 the router builds its state from the
          launch URL ('/'), so it needs a navigator to exist on the first render. */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Signed-in only. Signed-out users who hit these are sent to '/' (the index screen). */}
        <Stack.Protected guard={isSignedIn} redirectTo="/">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>

        {/* Signed-out only. Signed-in users who land on '/' are sent to home. */}
        <Stack.Protected guard={!isSignedIn} redirectTo="/home">
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
        </Stack.Protected>
      </Stack>

      {/* Loader sits on top instead of replacing the navigator. */}
      {status === 'loading' ? (
        <View className="absolute inset-0 bg-black">
          <OrbitLoader />
        </View>
      ) : null}
    </>
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