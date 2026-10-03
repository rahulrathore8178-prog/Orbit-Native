import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Brain, ChartArea, Home, MessageCircle, PersonStanding, Search } from 'lucide-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'black',       // Background color of the bar
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
          headerTitle: 'Your Orbital Profile',      // override just the header text
          headerShown: true,
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#fff',
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <ChartArea size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}
