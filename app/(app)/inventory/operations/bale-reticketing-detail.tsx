import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera } from 'lucide-react-native';

type MessageType = 'info' | 'success' | 'error';

type BaleInfo = {
  id: string;
  barcode: string | null;
  logistics_barcode: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  location_id: number | null;
  location_name: string | null;
  product_id: number | null;
  product_name: string | null;
  grade: number | null;
  grade_name: string | null;
  mass: number | null;
  grower_number: string | null;
};

const BaleReticketingDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ baleId?: string; logisticsBarcode?: string }>();
  const [bale, setBale] = useState<BaleInfo | null>(null);
  const [newBarcode, setNewBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);

  const loadBale = async () => {
    if (!params.baleId) return;
    try {
      const record = await powersync.getOptional<BaleInfo>(
        `SELECT b.id,
                b.barcode,
                b.logistics_barcode,
                b.warehouse_id,
                wh.name AS warehouse_name,
                b.location_id,
                COALESCE(loc.display_name, loc.name) AS location_name,
                b.product_id,
                prod.name AS product_name,
                b.grade,
                g.name AS grade_name,
                b.mass,
                b.grower_number
         FROM warehouse_shipped_bale b
         LEFT JOIN warehouse_warehouse wh ON wh.id = b.warehouse_id
         LEFT JOIN warehouse_location loc ON loc.id = b.location_id
         LEFT JOIN warehouse_product prod ON prod.id = b.product_id
         LEFT JOIN warehouse_bale_grade g ON g.id = b.grade
         WHERE b.id = ?
         LIMIT 1`,
        [params.baleId]
      );
      if (record) {
        setBale(record);
        setMessage(`Bale found. Current barcode: ${record.barcode || 'N/A'}`);
        setMessageType('success');
      } else {
        setMessage('Bale not found locally.');
        setMessageType('error');
      }
    } catch (err: any) {
      console.error('Load bale error', err);
      setMessage(err?.message || 'Error loading bale.');
      setMessageType('error');
    }
  };

  useEffect(() => {
    loadBale();
  }, [params.baleId]);

  const handleReticket = async () => {
    if (!bale) {
      Alert.alert('No bale loaded', 'Go back and search again.');
      return;
    }

    if (!newBarcode) {
      Alert.alert('Missing new barcode', 'Please enter the new barcode.');
      return;
    }

    if (newBarcode === (bale.barcode || '')) {
      setMessage('New barcode cannot be the same as the current barcode.');
      setMessageType('error');
      return;
    }

    try {
      // Ensure new barcode is unique
      const existing = await powersync.getOptional<{ id: string }>(
        `SELECT id FROM warehouse_shipped_bale WHERE barcode = ? AND id != ? LIMIT 1`,
        [newBarcode, bale.id]
      );
      if (existing) {
        setMessage(`Barcode '${newBarcode}' already exists on another bale. Use a different barcode.`);
        setMessageType('error');
        return;
      }

      // Update bale locally (reticketing - use 'reclassified' operation_type like Odoo wizard does)
      // Connector will detect this is reticketing (not reclassification) because only barcode is updated, not grade
      await powersync.execute(
        `UPDATE warehouse_shipped_bale
         SET barcode = ?, operation_type = 'reclassified', write_date = ?
         WHERE id = ?`,
        [newBarcode, new Date().toISOString(), bale.id]
      );

      setMessage(
        `Reticketed successfully. Old: ${bale.barcode || 'N/A'} → New: ${newBarcode}.`
      );
      setMessageType('success');
      setBale({ ...bale, barcode: newBarcode });
      setNewBarcode('');
    } catch (err: any) {
      console.error('Reticket bale error', err);
      setMessage(err?.message || 'Error reticketing bale.');
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
      <Stack.Screen options={{ title: 'Bale Reticketing', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            setScannerVisible(false);
            setNewBarcode(code);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan New Barcode"
        />
      </Modal>
      <ScrollView className="flex-1 bg-white p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header card */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Bale Reticketing</Text>
          <Text className="text-base text-blue-900">
            Update the barcode for the selected bale.
          </Text>
          {params.logisticsBarcode ? (
            <Text className="text-base text-blue-900 mt-1">
              Logistics: {params.logisticsBarcode}
            </Text>
          ) : null}
        </View>

        {/* Bale info */}
        {bale ? (
          <View className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <Text className="text-gray-900 font-semibold mb-1">Current Barcode: {bale.barcode || 'N/A'}</Text>
            <Text className="text-gray-700">
              Grade: {bale.grade_name || bale.grade || 'N/A'}
            </Text>
            <Text className="text-gray-700">
              Mass: {bale.mass !== null ? bale.mass : 'N/A'}
            </Text>
            <Text className="text-gray-700">
              Warehouse: {bale.warehouse_name || bale.warehouse_id || 'N/A'}
            </Text>
            <Text className="text-gray-700">
              Location: {bale.location_name || 'N/A'}
            </Text>
            <Text className="text-gray-700">
              Product: {bale.product_name || bale.product_id || 'N/A'}
            </Text>
            {bale.grower_number ? (
              <Text className="text-gray-700">Grower: {bale.grower_number}</Text>
            ) : null}
          </View>
        ) : (
          <Text className="text-gray-700 mb-4">Loading bale details...</Text>
        )}

        {/* New barcode input */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">New Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter new barcode..."
              value={newBarcode}
              onChangeText={setNewBarcode}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleReticket}
            />
            <TouchableOpacity
              onPress={() => setScannerVisible(true)}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message area */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Buttons side by side */}
        <View className="mt-2 flex-row gap-3">
          <TouchableOpacity
            onPress={handleReticket}
            className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
            disabled={!bale}
          >
            <Text className="text-white font-bold text-lg">Reticket Bale</Text>
          </TouchableOpacity>
        <TouchableOpacity
            onPress={() => {
              if (bale && bale.barcode) {
                Alert.alert(
                  'Reticketing Complete',
                  `✅ Bale reticketed successfully!\n📦 Current Barcode: ${bale.barcode}\n${bale.logistics_barcode ? `📋 Logistics: ${bale.logistics_barcode}\n` : ''}${bale.warehouse_name ? `🏢 Warehouse: ${bale.warehouse_name}\n` : ''}${bale.location_name ? `📍 Location: ${bale.location_name}` : ''}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.back(),
                    },
                  ]
                );
              } else {
                router.back();
              }
            }}
            className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center"
        >
            <Text className="text-white font-semibold text-lg">Done</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

export default BaleReticketingDetailScreen;

