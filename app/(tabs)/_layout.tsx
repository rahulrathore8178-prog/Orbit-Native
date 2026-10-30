import '@/global.css';
import { DrawerProvider } from '@/components/sideDrawer/DrawerContext';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { Tabs } from 'expo-router';
import { Brain, ChartArea, Home, Search } from 'lucide-react-native';
import { ChatTabIcon } from '@/components/ui/chats/TabBadgeDot';
import { HomeDrawerHost } from '@/components/ui/HomeDrawerHost';

export default function TabLayout() {

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
            tabBarIcon: ({ color }) => <Home size={23} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color }) => <ChatTabIcon color={color} />,
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
            headerTitleAlign: 'center',
            tabBarIcon: ({ color }) => <ChartArea size={23} color={color} />,
          }}
        />
      </Tabs>
      <HomeDrawerHost />
    </DrawerProvider>
  );
}
