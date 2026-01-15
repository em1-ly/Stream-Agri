import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import apiClient from '@/api/odoo_api';
import { powersync } from '@/powersync/system';

type MessageType = 'info' | 'success' | 'error';

type Transport = { id: number; name: string };

const CreateMissingReceiptNoteScreen = () => {
  const [origin, setOrigin] = useState('');
  const [truckRegNumber, setTruckRegNumber] = useState('');
  const [transportId, setTransportId] = useState<number | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverNationalId, setDriverNationalId] = useState('');
  const [driverCellphone, setDriverCellphone] = useState('');
  const [dnoteDate, setDnoteDate] = useState<string>(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [transports, setTransports] = useState<Transport[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const router = useRouter();

  useEffect(() => {
    const loadTransports = async () => {
      try {
        const rows = await powersync.getAll<Transport>(
          `SELECT id, name FROM warehouse_transport ORDER BY name`
        );
        setTransports(rows || []);
      } catch (err) {
        console.error('Failed to load transports', err);
      }
    };
    loadTransports();
  }, []);

  const handleSubmit = async () => {
    if (!truckRegNumber || !transportId || !driverName || !driverNationalId || !driverCellphone || !dnoteDate) {
      setMessage('Please fill all required fields.');
      setMessageType('error');
      return;
    }

    try {
      const payload = {
        jsonrpc: '2.0',
        params: {
          type: 'warehouse_missing_dnote_create',
          data: {
            origin,
            truck_reg_number: truckRegNumber,
            transport_id: transportId,
            driver_name: driverName,
            driver_national_id: driverNationalId,
            driver_cellphone: driverCellphone,
            dnote_date: dnoteDate,
          },
        },
      };

      const response = await apiClient.post('/api/fo/create_unified', payload);
      const result = response.data?.result ?? response.data;

      if (!result?.success) {
        setMessage(result?.message || 'Failed to create missing receipt note.');
        setMessageType('error');
        return;
      }

      setMessage(result?.message || 'Missing receipt note created successfully.');
      setMessageType('success');

      // If missing_dnote_id returned, navigate to add-bales flow
      if (result?.missing_dnote_id) {
        router.push({
          pathname: '/inventory/manual-entries/missing-receipt-add-bales',
          params: { missingDnoteId: String(result.missing_dnote_id) },
        });
      }
    } catch (err: any) {
      console.error('Missing receipt note error', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'System error while creating missing receipt note.';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const messageBg =
    messageType === 'success'
      ? 'bg-green-100'
      : messageType === 'error'
      ? 'bg-red-100'
      : 'bg-blue-100';
  const messageText =
    messageType === 'success'
      ? 'text-green-800'
      : messageType === 'error'
      ? 'text-red-800'
      : 'text-blue-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Create Missing Receipt Note', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">Missing Receipt Note</Text>
            <Text className="text-base text-blue-900">
              Enter truck and driver details to create a missing receipt note.
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Origin</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter origin..."
              value={origin}
              onChangeText={setOrigin}
              autoCapitalize="characters"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Truck Reg Number *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter truck registration..."
              value={truckRegNumber}
              onChangeText={setTruckRegNumber}
              autoCapitalize="characters"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Transport Name *</Text>
            <View className="bg-gray-100 border border-gray-300 rounded-lg">
              <ScrollView style={{ maxHeight: 200 }}>
                {transports.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    className={`p-3 border-b border-gray-200 ${transportId === t.id ? 'bg-blue-100' : 'bg-white'}`}
                    onPress={() => setTransportId(t.id)}
                  >
                    <Text className="text-base text-gray-900">{t.name}</Text>
                  </TouchableOpacity>
                ))}
                {transports.length === 0 && (
                  <Text className="text-center text-gray-500 py-3">No transports synced</Text>
                )}
              </ScrollView>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Driver *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter driver name..."
              value={driverName}
              onChangeText={setDriverName}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Driver National ID *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter driver national ID..."
              value={driverNationalId}
              onChangeText={setDriverNationalId}
              autoCapitalize="characters"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Driver Cellphone *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter driver cellphone..."
              value={driverCellphone}
              onChangeText={setDriverCellphone}
              keyboardType="phone-pad"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Receipt Date *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="YYYY-MM-DD"
              value={dnoteDate}
              onChangeText={setDnoteDate}
              autoCapitalize="none"
            />
          </View>

          {message ? (
            <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
              <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Create Missing Receipt Note</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default CreateMissingReceiptNoteScreen;


