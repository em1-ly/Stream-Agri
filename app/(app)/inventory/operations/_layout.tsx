import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi, WifiOff, ChevronLeft } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

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
    <View className="flex-row items-center justify-center mr-2">
      {syncStatus ? (
        <Wifi size={20} color="#10B981" strokeWidth={2.5} />
      ) : (
        <WifiOff size={20} color="#EF4444" strokeWidth={2.5} />
      )}
    </View>
  );
}

export default function OperationsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#65435C' }}>
      <StatusBar backgroundColor="#65435C" barStyle="light-content" />
      
      <Stack
        screenOptions={{
          headerShown: true,
          header: ({ options, navigation }) => {
            const title = typeof options.headerTitle === 'string' 
              ? options.headerTitle 
              : options.title || 'Operations';
            return (
              <View style={{ backgroundColor: '#65435C', paddingTop: insets.top }}>
                <View className="flex-row items-center justify-between mb-1 bg-white py-5 px-4">
                  <TouchableOpacity
                    className="flex-row items-center"
                    onPress={() => navigation.goBack()}
                  >
                    <ChevronLeft size={24} color="#65435C" />
                    <Text className="text-[#65435C] font-bold text-lg ml-2">
                      {title}
                    </Text>
                  </TouchableOpacity>
                  <SyncStatusIcon />
                </View>
              </View>
            );
          },
          contentStyle: {
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Operations Home' }} />
        <Stack.Screen name="stack-bales" options={{ title: 'Stack Bales' }} />
        <Stack.Screen name="stack-bale-scan" options={{ title: 'Scan Stack Bales' }} />
        <Stack.Screen name="rack-loading" options={{ title: 'Rack Loading' }} />
        <Stack.Screen name="rack-loading-scan" options={{ title: 'Scan Rack Loading' }} />
        <Stack.Screen name="reclassify-bales" options={{ title: 'Reclassify Bales' }} />
        <Stack.Screen name="reclassify-bale-scan" options={{ title: 'Scan Reclassify' }} />
        <Stack.Screen name="remove-bales-from-rack" options={{ title: 'Remove from Rack' }} />
        <Stack.Screen name="bale-history-query" options={{ title: 'Bale History' }} />
        <Stack.Screen name="bale-reticketing" options={{ title: 'Bale Reticketing' }} />
        <Stack.Screen name="bale-reticketing-detail" options={{ title: 'Reticketing Details' }} />
        <Stack.Screen name="ticketing" options={{ title: 'Ticketing' }} />
      </Stack>
    </View>
  );
}
