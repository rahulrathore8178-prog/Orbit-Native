import "@/global.css";
import { store } from '@/redux/store';
import { Slot } from "expo-router";
import { Provider } from 'react-redux';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Slot />
    </Provider>
  );
}