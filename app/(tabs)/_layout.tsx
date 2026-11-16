import { DrawerProvider } from '@/components/sideDrawer/DrawerContext';
import { ChatTabIcon } from '@/components/ui/chats/TabBadgeDot';
import { FlareIcon } from '@/components/ui/flare/FlareIcon';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { HomeDrawerHost } from '@/components/ui/HomeDrawerHost';
import '@/global.css';
import { Tabs } from 'expo-router';
import { Brain, ChartArea, Home, Search } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';

export default function TabLayout() {
  const activeAccountId = useSelector((state: RootState) => state.auth.activeAccountId);

  return (
    <DrawerProvider>
      <Tabs
        key={activeAccountId ?? 'signed-out'}
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
          name="Flares"
          options={{
            title: 'Flares',
            tabBarIcon: ({ color }) => <FlareIcon size={30} color={color} />,
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
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color }) => <Search size={23} color={color} />,
          }}
        />
        {/* <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerStyle: { backgroundColor: '#000000' },
            headerTitleAlign: 'center',
            tabBarIcon: ({ color }) => <ChartArea size={23} color={color} />,
          }}
        /> */}
      </Tabs>
      <HomeDrawerHost />
    </DrawerProvider>
  );
}
