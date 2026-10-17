import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch, useSelector, useStore } from 'react-redux';

import { store as reduxStore } from '@/redux/store'; // adjust to your store path
import { bootstrapAuth, signOut } from '@/redux/slice/authSlice';
import { setupAxios, setUnauthorizedHandler } from '@/lib/auth/setupAxios';
import OrbitLoader from '@/components/ui/OrbitLoader'; // adjust to your loader path

SplashScreen.preventAutoHideAsync();
setupAxios(); // interceptors installed once, before any screen makes a request

function AuthGate() {
  // Swap `any` for your typed hooks (AppDispatch / RootState) if you have them.
  const dispatch = useDispatch();
  const status = useSelector((s) => s.auth.status);

  // 1) Decide signedIn / signedOut once on start.
  useEffect(() => {
    dispatch(bootstrapAuth());
    SplashScreen.hideAsync();
  }, [dispatch]);

  // 2) Any 401 from your API while signed in = session expired -> log out cleanly.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (reduxStore.getState().auth.status === 'signedIn') dispatch(signOut());
    });
    return () => setUnauthorizedHandler(null);
  }, [dispatch]);

  if (status === 'loading') return <OrbitLoader />;

  const isSignedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Signed-in only. Listed first so it's the landing route after login. */}
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>

      {/* Signed-out only. */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="singup" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={reduxStore}>
        <AuthGate />
      </Provider>
    </GestureHandlerRootView>
  );
}