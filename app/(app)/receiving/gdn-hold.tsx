import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SuccessToast } from '@/components/SuccessToast';
import { usePowerSync } from '@powersync/react';

export default function GdnHoldScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const powersync = usePowerSync();

  const run = async () => {
    try {
      if (!id || typeof id !== 'string') {
        Alert.alert('Error', 'Invalid Delivery Note ID.');
        return;
      }
      setLoading(true);

      await powersync.execute('UPDATE receiving_grower_delivery_note SET state = ? WHERE id = ?', ['hold', id]);

      const message = 'Delivery note has been marked as held. It will be processed in the background.';
      setSuccessMessage(message);
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Stack.Screen options={{ title: 'Hold Delivery Note' }} />
      <Text className="text-gray-700 mb-4">Puts the delivery note on hold.</Text>
      <TouchableOpacity className={`rounded-xl p-4 ${loading ? 'bg-gray-400' : 'bg-amber-500'}`} disabled={loading} onPress={run}>
        <Text className="text-white font-bold text-center">{loading ? 'Working...' : 'Hold Note'}</Text>
      </TouchableOpacity>
      
      <SuccessToast
        visible={showSuccess}
        message={successMessage}
        onHide={() => setShowSuccess(false)}
      />
    </View>
  );
}


