import { DrawerProvider } from '@/components/sideDrawer/DrawerContext';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { useTabBarLayout } from '@/hooks/useTabBarLayout';
import { Stack, Tabs } from 'expo-router';
import { Brain, ChartArea, Home, MessageCircle, Search } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';

export default function TabLayout() {
  const bar = useTabBarLayout();
  const { width: screenWidth } = useWindowDimensions();

  const BAR_WIDTH = Math.min(screenWidth - 40, 360); // 20px gap each side, capped
  const BAR_LEFT = (screenWidth - BAR_WIDTH) / 2;    // exact centre

  return (
    <DrawerProvider>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          // headerTitle: 'Orb8',      // override just the header text
          // headerShown: true,
          // headerStyle: { backgroundColor: '#0f0f0f' },
          // headerTintColor: '#fff',
          // headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <Home size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',                // used for tab label AND header title by default
          // headerRight: () => <NewChatButton />,
          tabBarIcon: ({ color }) => <MessageCircle size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="AskIgris"
        options={{
          title: 'AskIgris',
          tabBarIcon: ({ color }) => <Brain size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerStyle: { backgroundColor: '#000000' },
          // headerTintColor: '#ffffff',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <ChartArea size={23} color={color} />,
        }}
      />
    </Tabs>
    </DrawerProvider>
  );
}
