import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StatusBar, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BarChart, House, Leaf, Settings, Users, ClipboardList, Wifi, WifiOff, Building2 } from 'lucide-react-native';
import { setupPowerSync, powersync } from '@/powersync/system';
// Sync Status Icon Component
function SyncStatusIcon() {
  const [syncStatus, setSyncStatus] = useState(!!powersync.currentStatus?.connected);

  useEffect(() => {
    const unregister = powersync.registerListener({
      statusChanged: (status) => {
        setSyncStatus(!!status.connected);
      },
    });
    return unregister;
  }, []);

  return (
    <View className="flex-row items-center justify-center mr-4">
      {syncStatus ? (
        <Wifi size={24} color="#10B981" strokeWidth={2.5} />
      ) : (
        <WifiOff size={24} color="#EF4444" strokeWidth={2.5} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const initSync = async () => {
      try {
        await setupPowerSync();
      } catch (e) {
        console.warn('Failed to setup PowerSync in TabLayout:', e);
      }
    };
    initSync();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1AD3BB",
        tabBarInactiveTintColor: "#65435C",
        headerShown: true,
        headerStyle: {
          height: insets.top + 50, // Reduced from 60+StatusBar to be tighter
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          fontSize: 16,
          color: '#65435C',
          fontWeight: '600',
        },
        headerBackground: () => (
          <View style={{ flex: 1 }}>
            {/* Dark purple area for status bar - using precise inset */}
            <View style={{ height: insets.top, backgroundColor: '#65435C' }} />
            {/* White area for custom navbar content */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
          </View>
        ),
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Curverid Tobacco Private Limited',
          headerTitleAlign: 'left',
          headerLeft: () => (
            <View style={{ marginLeft: 16 }}>
               <Building2 size={20} color="#1AD3BB" />
            </View>
          ),
          tabBarIcon: ({ color }) => <House size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receiving"
        options={{
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          headerRight: () => <SyncStatusIcon />,
        }}
      />
    
      <Tabs.Screen
        name="datacapturing"
        options={{
          title: 'Data Capturing',
          headerShown: true,
          tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} />,
          headerRight: () => <SyncStatusIcon />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: true,
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          headerRight: () => <SyncStatusIcon />,
        }}
      />
       {/* <Tabs.Screen
        name="two"
        options={{
          title: 'Two',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="key.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      /> */}
     
    </Tabs>
  );
}
