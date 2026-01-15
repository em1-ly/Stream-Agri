import React from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

const DispatchProductsScreen = () => {
  return (
    <>
      <Stack.Screen options={{ title: 'Dispatch Products' }} />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-1 bg-white rounded-2xl p-4 items-center justify-center">
          <Text className="text-lg font-semibold text-[#65435C] mb-2">
            Dispatch Products
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            This flow is not yet implemented on mobile.
          </Text>
        </View>
      </View>
    </>
  );
};

export default DispatchProductsScreen;


