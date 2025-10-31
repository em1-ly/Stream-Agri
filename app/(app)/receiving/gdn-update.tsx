import React from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function GdnUpdateScreen() {
  return (
    <View className="flex-1 bg-white p-4">
      <Stack.Screen options={{ title: 'Update Delivery Note' }} />
      <Text className="text-gray-700">Coming soon: UI to update the delivery note header (change grower/sale date/selling point via wizard).</Text>
    </View>
  );
}


