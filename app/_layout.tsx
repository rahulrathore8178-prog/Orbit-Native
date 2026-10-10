import "@/global.css";
import { store } from '@/redux/store';
import { Slot, Stack } from "expo-router";
import { Provider } from 'react-redux';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orbital" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </Provider>
  );
};