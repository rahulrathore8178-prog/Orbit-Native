import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee from 'react-native-notify-kit';

// Notification messages are shown by the OS itself while the app is in the background or killed.
// This handler is the place for data-only messages (e.g. incoming calls) later.
setBackgroundMessageHandler(getMessaging(), async () => {});
notifee.onBackgroundEvent(async () => {});