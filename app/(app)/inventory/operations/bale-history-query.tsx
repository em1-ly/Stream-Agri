import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Keyboard } from 'react-native';
import { Stack } from 'expo-router';
import { powersync } from '@/powersync/system';
import BarcodeScanner from '../../../../components/BarcodeScanner';
import { Camera } from 'lucide-react-native';

type AuditRecord = {
  audit_date?: string | null;
  barcode?: string | null;
  logistics_barcode?: string | null;
  operation_type?: string | null;
  warehouse_name?: string | null;
  location_name?: string | null;
};

type MessageType = 'info' | 'success' | 'error';

const BaleHistoryQueryScreen = () => {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [message, setMessage] = useState<string>('Enter a barcode or logistics barcode to search history.');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);

  const handleSearch = async () => {
    Keyboard.dismiss();
    if (!query) {
      setMessage('Please enter a barcode or logistics barcode.');
      setMessageType('error');
      setRecords([]);
      return;
    }

    try {
      // Resolve logistics barcode: try match barcode or logistics_barcode
      const shipped = await powersync.getOptional<{ logistics_barcode: string | null; barcode: string | null }>(
        `SELECT logistics_barcode, barcode
         FROM warehouse_shipped_bale
         WHERE barcode = ? OR logistics_barcode = ?
         LIMIT 1`,
        [query, query]
      );

      const resolvedLogistics = shipped?.logistics_barcode || shipped?.barcode || query;

      const audits = await powersync.getAll<AuditRecord>(
        `SELECT audit_date, barcode, logistics_barcode, operation_type, warehouse_name, location_name
         FROM warehouse_audit_shipped_bale
         WHERE logistics_barcode = ?
         ORDER BY audit_date DESC`,
        [resolvedLogistics]
      );

      if (!audits || audits.length === 0) {
        setMessage(`No audit records found for logistics barcode '${resolvedLogistics}'.`);
        setMessageType('error');
        setRecords([]);
        return;
      }

      setRecords(audits);
      setMessage(`Found ${audits.length} audit record(s) for logistics barcode '${resolvedLogistics}'.`);
      setMessageType('success');
    } catch (err: any) {
      console.error('Bale history query error', err);
      setMessage(err?.message || 'Error fetching bale history.');
      setMessageType('error');
      setRecords([]);
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
      <Stack.Screen options={{ title: 'Bale History Query', headerShown: true }} />

      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            // 1) Hide instantly
            setScannerVisible(false);
            
            // 2) Defer
            setTimeout(() => {
            setQuery(code);
              // Auto search when scanned
              handleSearch();
            }, 0);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Barcode"
        />
      </Modal>

      <ScrollView className="flex-1 bg-white p-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header card */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Bale History Query</Text>
          <Text className="text-base text-blue-900">
            Enter a barcode or logistics barcode to view audit history.
          </Text>
        </View>

        {/* Search input */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Barcode / Logistics Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter or scan barcode..."
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setScannerVisible(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleSearch}
            className="mt-3 bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Search</Text>
          </TouchableOpacity>
        </View>

        {/* Message */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Results */}
        {records.length > 0 && (
          <View className="space-y-3">
            {records.map((rec, idx) => (
              <View key={`${rec.audit_date || 'row'}-${idx}`} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <Text className="text-gray-900 font-semibold">
                  Date: {rec.audit_date || 'N/A'}
                </Text>
                <Text className="text-gray-800">Barcode: {rec.barcode || 'N/A'}</Text>
                <Text className="text-gray-800">
                  Logistics: {rec.logistics_barcode || 'N/A'}
                </Text>
                <Text className="text-gray-800">
                  Operation: {rec.operation_type || 'N/A'}
                </Text>
                {rec.warehouse_name ? (
                  <Text className="text-gray-800">Warehouse: {rec.warehouse_name}</Text>
                ) : null}
                {rec.location_name ? (
                  <Text className="text-gray-800">Location: {rec.location_name}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
};

export default BaleHistoryQueryScreen;


