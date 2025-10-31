import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

export default function EditGdnScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const ActionButton = ({ label, onPress, color = '#65435C' }: { label: string; onPress: () => void; color?: string }) => (
    <TouchableOpacity className="rounded-xl p-4 mb-3" style={{ backgroundColor: color }} onPress={onPress}>
      <Text className="text-white font-bold text-center">{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white p-4">
      <Stack.Screen options={{ title: 'Edit GDN' }} />
      <ScrollView>
        <Text className="text-base text-gray-600 mb-4">Document ID: {String(id || '')}</Text>
        <ActionButton label="Check Grower Register for Details" onPress={() => router.push(`/receiving/gdn-check-grower?id=${id}`)} />
        <ActionButton label="Add Bale" onPress={() => router.push('/receiving/add-bale-to-gd-note')} />
        <ActionButton label="Update DNote" onPress={() => router.push(`/receiving/gdn-update?id=${id}`)} />
        <ActionButton label="Hold Delivery Note" color="#f59e0b" onPress={() => router.push(`/receiving/gdn-hold?id=${id}`)} />
        <ActionButton label="Close Delivery Note" color="#059669" onPress={() => router.push(`/receiving/gdn-close?id=${id}`)} />
      </ScrollView>
    </View>
  );
}


