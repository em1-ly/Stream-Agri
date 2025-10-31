import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { SuccessToast } from '@/components/SuccessToast';

export default function GdnCloseScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const run = async () => {
    try {
      setLoading(true);
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      const base = (url: string | null) => !url ? '' : (url.startsWith('http') ? url : `https://${url}`);
      const res = await fetch(`${base(serverURL)}/api/fo/receiving/gdn/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-FO-TOKEN': token || '' },
        body: JSON.stringify({ id: Number(id) })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        Alert.alert('Failed', body?.message || `HTTP ${res.status}`);
      } else {
        const message = body.message || 'Delivery note closed successfully!';
        setSuccessMessage(message);
        setShowSuccess(true);
        Alert.alert('Success', message);
      }
    } catch (e: any) {
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Stack.Screen options={{ title: 'Close Delivery Note' }} />
      <Text className="text-gray-700 mb-4">Closes the delivery note if all rules are satisfied.</Text>
      <TouchableOpacity className={`rounded-xl p-4 ${loading ? 'bg-gray-400' : 'bg-emerald-600'}`} disabled={loading} onPress={run}>
        <Text className="text-white font-bold text-center">{loading ? 'Working...' : 'Close Note'}</Text>
      </TouchableOpacity>
      
      <SuccessToast
        visible={showSuccess}
        message={successMessage}
        onHide={() => setShowSuccess(false)}
      />
    </View>
  );
}


