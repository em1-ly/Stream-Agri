import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Keyboard, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera } from 'lucide-react-native';

type MessageType = 'info' | 'success' | 'error';

type BaleInfo = {
  id: string;
  barcode: string;
  logistics_barcode: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  location_id: string | null;
  location_name: string | null;
  product_id: string | null;
  product_name: string | null;
  grade: string | null;
  grade_name: string | null;
  mass: number | null;
  grower_number: string | null;
};

const TicketingScreen = () => {
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [newLogisticsBarcode, setNewLogisticsBarcode] = useState('');
  const [foundBale, setFoundBale] = useState<BaleInfo | null>(null);
  const [message, setMessage] = useState('Scan barcode and click "Search Bale" to find the bale for ticketing.');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanTarget, setScanTarget] = useState<'barcode' | 'logistics'>('barcode');
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const resetForm = () => {
    setBarcode('');
    setNewLogisticsBarcode('');
    setFoundBale(null);
    setMessage('Enter barcode and click "Search Bale" to find the bale for ticketing.');
    setMessageType('info');
  };

  const handleSearch = async () => {
    Keyboard.dismiss();
    if (!barcode) {
      Alert.alert('Missing barcode', 'Please enter a barcode.');
      return;
    }

    setIsSearching(true);
    try {
      const bale = await powersync.getOptional<BaleInfo>(
        `SELECT b.id,
                b.barcode,
                b.logistics_barcode,
                b.warehouse_id,
                wh.name AS warehouse_name,
                b.location_id,
                loc.display_name AS location_name,
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
         WHERE b.barcode = ?
         LIMIT 1`,
        [barcode]
      );

      if (bale) {
        setFoundBale(bale);
        setMessage(`Bale found successfully! Current luggage barcode: ${bale.logistics_barcode || 'No luggage barcode assigned'}`);
        setMessageType('success');
      } else {
        setFoundBale(null);
        setMessage(`No bale found with barcode '${barcode}'. Please verify the barcode and try again.`);
        setMessageType('error');
      }
      setIsSearching(false);
    } catch (err: any) {
      console.error('Search bale error', err);
      setMessage(err?.message || 'Error searching for bale.');
      setMessageType('error');
      setIsSearching(false);
    }
  };

  const handleUpdate = async () => {
    Keyboard.dismiss();
    if (!foundBale) {
      Alert.alert('No bale selected', 'Please search for a bale first.');
      return;
    }

    if (!newLogisticsBarcode) {
      Alert.alert('Missing new barcode', 'Please enter a new luggage barcode.');
      return;
    }

    if (newLogisticsBarcode === foundBale.logistics_barcode) {
      Alert.alert('Duplicate barcode', 'New luggage barcode cannot be the same as the current luggage barcode.');
      return;
    }

    setIsSaving(true);
    try {
      // Check if new luggage barcode already exists on another bale
      const existing = await powersync.getOptional<any>(
        'SELECT id FROM warehouse_shipped_bale WHERE logistics_barcode = ? AND id != ? LIMIT 1',
        [newLogisticsBarcode, foundBale.id]
      );

      if (existing) {
        Alert.alert('Barcode exists', `Luggage barcode '${newLogisticsBarcode}' already exists on another bale!`);
        setIsSaving(false);
        return;
      }

      const oldLogistics = foundBale.logistics_barcode;
      const now = new Date().toISOString();

      // Update the bale
      await powersync.execute(
        `UPDATE warehouse_shipped_bale 
         SET logistics_barcode = ?, 
             operation_type = 'ticketed',
             write_date = ?
         WHERE id = ?`,
        [newLogisticsBarcode, now, foundBale.id]
      );

      setMessage(`Ticketing completed successfully! Old Luggage Barcode: ${oldLogistics || "N/A"} New Logistics Barcode: ${newLogisticsBarcode}. Enter another barcode for ticketing another bale.`);
      setMessageType('success');
      
      // Reset search fields but keep success message
      setBarcode('');
      setNewLogisticsBarcode('');
      setFoundBale(null);
      setIsSaving(false);
    } catch (err: any) {
      console.error('Update bale error', err);
      setMessage(err?.message || 'Error updating bale.');
      setMessageType('error');
      setIsSaving(false);
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
      <Stack.Screen options={{ title: 'Ticketing', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            setScannerVisible(false);
            setTimeout(() => {
              if (scanTarget === 'barcode') {
                setBarcode(code);
              } else {
                setNewLogisticsBarcode(code);
              }
            }, 0);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title={scanTarget === 'barcode' ? 'Scan Bale Barcode' : 'Scan New Logistics Barcode'}
        />
      </Modal>
      <ScrollView className="flex-1 bg-white p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header card */}
        <View className={`p-4 rounded-lg border mb-4 ${messageBg} ${messageType === 'success' ? 'border-green-300' : messageType === 'error' ? 'border-red-300' : 'border-blue-300'}`}>
          <Text className={`text-lg font-bold mb-2 ${messageText}`}>Ticketing</Text>
          <Text className={`text-base ${messageText}`}>
            {message}
          </Text>
        </View>

        {/* Barcode input section */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Carton Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or type barcode..."
              value={barcode}
              onChangeText={setBarcode}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setScanTarget('barcode');
                setScannerVisible(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {!foundBale && (
          <TouchableOpacity
            onPress={handleSearch}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center mb-4 flex-row"
            disabled={isSearching}
            style={{ opacity: isSearching ? 0.7 : 1 }}
          >
            {isSearching ? (
              <>
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">Searching...</Text>
              </>
            ) : (
            <Text className="text-white font-bold text-lg">Search Bale</Text>
            )}
          </TouchableOpacity>
        )}

        {foundBale && (
          <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
            <Text className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Bale Information</Text>
            
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Warehouse:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.warehouse_name || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Location:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.location_name || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Product:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.product_name || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Grade:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.grade_name || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Mass:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.mass ? `${foundBale.mass.toFixed(2)} kg` : '0.00 kg'}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">Grower Number:</Text>
              <Text className="font-semibold text-gray-800">{foundBale.grower_number || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Current Logistics:</Text>
              <Text className="font-semibold text-blue-600">{foundBale.logistics_barcode || 'N/A'}</Text>
            </View>
          </View>
        )}

        {foundBale && (
          <View className="mb-6">
            <Text className="text-gray-800 font-semibold mb-1">New Luggage Label</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-white border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Scan or enter new barcode..."
                value={newLogisticsBarcode}
                onChangeText={setNewLogisticsBarcode}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScanTarget('logistics');
                  setScannerVisible(true);
                }}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {foundBale && (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleUpdate}
              className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center flex-row"
              disabled={isSaving}
              style={{ opacity: isSaving ? 0.7 : 1 }}
            >
              {isSaving ? (
                <>
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">Saving...</Text>
                </>
              ) : (
              <Text className="text-white font-bold text-lg">Update Barcode</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={resetForm}
              className="flex-1 bg-gray-200 p-4 rounded-lg items-center justify-center"
              disabled={isSaving}
            >
              <Text className="text-gray-800 font-semibold text-lg">Reset</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
};

export default TicketingScreen;

