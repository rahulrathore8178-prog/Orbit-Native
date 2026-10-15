import "@/global.css";
import { store } from '@/redux/store';
import { Slot, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Provider } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OrbitLoader from '@/components/ui/OrbitLoader'; // adjust path
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();
export default function RootLayout() {

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.getItem('token'); // put your real startup work here (fonts, auth check)
        await new Promise((r) => setTimeout(r, 800)); // minimum show time, avoids a flicker
      } finally {
        setAppReady(true);
      }
    })();
  }, []);
  // if (!appReady) {
  //   return <OrbitLoader />;
  // }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <OrbitLoader visible={!appReady} />
      </Provider>
    </GestureHandlerRootView>
  );
};