import { HapticTab } from '@/components/haptic-tab';
import NeoTabButton from '@/components/ui/NeoTabButton';
import TabBarGlass from '@/components/ui/TabBarGlass';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarLayout } from '@/hooks/useTabBarLayout';
import { Stack, Tabs } from 'expo-router';
import { Brain, ChartArea, Home, MessageCircle, Search } from 'lucide-react-native';
import React from 'react';

export default function TabLayout() {
  const bar = useTabBarLayout();

  return (
    <Tabs
      screenOptions={{
        // tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: NeoTabButton,
        tabBarBackground: () => <TabBarGlass />,
        tabBarStyle: {
          // backgroundColor: 'black',
          position: 'absolute',
          left: 50,
          right: 20,
          bottom: bar.bottom,
          width: 450,
          height: bar.height,
          paddingTop: 0,
          paddingBottom: 0,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: '#ffffff',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 20,       // Background color of the bar
        },
      }}>
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
        name="askIgris"
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
          headerTintColor: '#ffffff',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <ChartArea size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}
