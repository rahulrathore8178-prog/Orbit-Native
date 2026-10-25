# Notifications + OrbitBackdrop

Files (merge into your project root):
- components/ui/OrbitBackdrop.tsx              reusable orbit background
- components/notifications/NotificationBell.tsx header bell + red mark + polling
- components/services/notificationsApi.ts       axios calls (same routes as the web page)
- redux/slice/notificationsSlice.ts             state, optimistic read, "seen" tracking
- app/notifications.tsx                         the page

Setup:
1. Register the reducer:   reducer: { ..., notifications }
2. Header: replace `<View className="w-9" />` (right side) with `<NotificationBell />`
3. Packages (probably already installed): lucide-react-native expo-linear-gradient expo-haptics
   @react-native-async-storage/async-storage
