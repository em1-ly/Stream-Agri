import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Camera } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Picker } from '@react-native-picker/picker';

type MessageType = 'info' | 'success' | 'error';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: any }>;
  placeholder: string;
}) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
    <View className="bg-gray-100 border border-gray-300 rounded-lg">
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        style={{ height: 50, color: value ? '#111827' : '#4B5563' }}
      >
        <Picker.Item label={placeholder} value="" color="#9CA3AF" />
        {items.map((item) => (
          <Picker.Item key={item.value} label={item.label} value={item.value} color="#374151" />
        ))}
      </Picker>
    </View>
  </View>
);

// Mobile version of SatelliteScanWizard.action_scan_bale via unified endpoint.
const SatelliteScanBalesScreen = () => {

  const router = useRouter();
  const params = useLocalSearchParams<{
    warehouseId?: string;
    locationId?: string;
    productId?: string;
  }>();

  const [barcode, setBarcode] = useState('');
  const [logisticsBarcode, setLogisticsBarcode] = useState('');
  const [mass, setMass] = useState('');
  const [baleCount, setBaleCount] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanningFor, setScanningFor] = useState<'barcode' | 'logistics'>('barcode');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Load initial bale count
  useEffect(() => {
    const loadBaleCount = async () => {
      if (params.warehouseId && params.locationId && params.productId) {
        try {
          // Count shipped bales with stock_status = 'satellite' for this warehouse/location/product
          // Dispatch bales will be created server-side when syncing
          const countResult = await powersync.getOptional<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM warehouse_shipped_bale 
             WHERE stock_status = 'satellite'
               AND warehouse_id = ?
               AND location_id = ?
               AND product_id = ?`,
            [Number(params.warehouseId), Number(params.locationId), Number(params.productId)]
          );
          setBaleCount(countResult?.count || 0);
        } catch (error) {
          console.error('Failed to load bale count:', error);
        }
      }
    };
    loadBaleCount();
  }, [params.warehouseId, params.locationId, params.productId]);

  const handleSaveBale = async (scannedCode?: string) => {
    const codeToProcess = (scannedCode || barcode);
    const logisticsCode = logisticsBarcode;
    const weight = mass.trim();

    if (!params.warehouseId || !params.locationId || !params.productId) {
      Alert.alert('Missing Context', 'Warehouse, Location or Product is missing. Please go back and start again.');
      return;
    }

    // Match Odoo validation: all three fields are required
    if (!codeToProcess) {
      setMessage('Please enter a barcode!');
      setMessageType('error');
      setIsSaving(false);
      return;
    }

    if (!logisticsCode) {
      setMessage('Please enter a Logistics Barcode!');
      setMessageType('error');
      setIsSaving(false);
      return;
    }

    if (!weight) {
      setMessage('Please enter a Weight!');
      setMessageType('error');
      setIsSaving(false);
      return;
    }

    // Validate weight is a number
    const numericWeight = Number(weight);
    if (isNaN(numericWeight) || numericWeight <= 0) {
      setMessage('Please enter a valid weight (number greater than 0)!');
      setMessageType('error');
      setIsSaving(false);
      return;
    }

    setMessage('');
    setIsSaving(true);

    try {
      // 1) Check if bale already exists in shipped_bale table (matching Odoo validation)
      const existing_shipped_bale = await powersync.getOptional<any>(
        `SELECT id, barcode, logistics_barcode 
         FROM warehouse_shipped_bale 
         WHERE barcode = ? OR logistics_barcode = ?
         LIMIT 1`,
        [codeToProcess, codeToProcess]
      );

      if (existing_shipped_bale) {
        const msg = `Bale '${codeToProcess}' already exists in warehouse.shipped_bale!`;
        setMessage(msg);
        setMessageType('error');
        setIsSaving(false);
        return;
      }

      // 2) Check if bale already exists in dispatch_bale table (matching Odoo validation)
      // Check via shipped_bale relationship
      const existing_dispatch_bale = await powersync.getOptional<any>(
        `SELECT db.id, db.shipped_bale_id, sb.barcode, sb.logistics_barcode
         FROM warehouse_dispatch_bale db
         LEFT JOIN warehouse_shipped_bale sb ON db.shipped_bale_id = sb.id
         WHERE sb.barcode = ? OR sb.logistics_barcode = ?
         LIMIT 1`,
        [codeToProcess, codeToProcess]
      );

      if (existing_dispatch_bale) {
        const msg = `Bale '${codeToProcess}' already exists in warehouse.dispatch_bale!`;
        setMessage(msg);
        setMessageType('error');
        setIsSaving(false);
        return;
      }

      // 3) Create new shipped_bale record with satellite status (matching Odoo _create_shipped_bale)
      // Dispatch bale will be created server-side via API when syncing to avoid validation errors
      const shippedBaleId = uuidv4();
      const now = new Date().toISOString();
      
      // Use logistics_barcode or fallback to barcode (matching Odoo: logistics_barcode or self.barcode)
      const finalLogisticsBarcode = logisticsCode || codeToProcess;

      await powersync.execute(
        `INSERT INTO warehouse_shipped_bale (
          id, barcode, logistics_barcode, product_id, warehouse_id, location_id, 
          stock_status, mass, received_mass, received, origin_document, create_date, write_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shippedBaleId,
          codeToProcess,
          finalLogisticsBarcode,
          Number(params.productId),
          Number(params.warehouseId),
          Number(params.locationId),
          'satellite',
          numericWeight,
          numericWeight,
          1, // received = true
          'satellite_dispatch', // Mark for dispatch_bale creation on server
          now,
          now
        ]
      );

      // Note: dispatch_bale will be created server-side via API when syncing
      // This avoids validation errors (dispatch_note_id requirement) and lets server handle creation properly

      // Success - update count and clear fields
      setMessage(`Bale '${codeToProcess}' created successfully! Total scanned: ${baleCount + 1}`);
      setMessageType('success');
      setBaleCount(prev => prev + 1);
      setIsSaving(false);

      // Clear all fields after successful scan (matching Odoo wizard)
      setBarcode('');
      setLogisticsBarcode('');
      setMass('');
      
      // Automatically open camera for next scan
      setTimeout(() => {
        setScannerVisible(true);
      }, 300);
    } catch (error: any) {
      console.error('Failed to save bale:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setMessage(`Error saving bale: ${errorMessage}`);
      setMessageType('error');
      setIsSaving(false);
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setScannerVisible(false);
    // Set the scanned barcode to the appropriate field (no save logic in camera)
    if (scanningFor === 'logistics') {
      setLogisticsBarcode(scannedBarcode);
    } else {
      setBarcode(scannedBarcode);
    }
    setScanningFor('barcode'); // Reset to default
  };

  const handleDone = async () => {
    try {
      // Fetch warehouse, location, and product names for summary
      let warehouseName = '';
      let locationName = '';
      let productName = '';

      if (params.warehouseId) {
        const warehouse = await powersync.getOptional<{ name: string }>(
          'SELECT name FROM warehouse_warehouse WHERE id = ?',
          [Number(params.warehouseId)]
        );
        warehouseName = warehouse?.name || '';
      }

      if (params.locationId) {
        const location = await powersync.getOptional<{ name: string; display_name: string }>(
          'SELECT name, display_name FROM warehouse_location WHERE id = ?',
          [Number(params.locationId)]
        );
        locationName = location?.display_name || location?.name || '';
      }

      if (params.productId) {
        const product = await powersync.getOptional<{ name: string }>(
          'SELECT name FROM warehouse_product WHERE id = ?',
          [Number(params.productId)]
        );
        productName = product?.name || '';
      }

      // Show success summary before navigating
      const summaryMessage = 
        `✅ Satellite Dispatch Scan Complete!\n\n` +
        `📦 Bales Scanned: ${baleCount}\n` +
        (warehouseName ? `🏢 Warehouse: ${warehouseName}\n` : '') +
        (locationName ? `📍 Location: ${locationName}\n` : '') +
        (productName ? `📋 Product: ${productName}` : '');

      Alert.alert(
        'Satellite Dispatch Complete',
        summaryMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error showing summary:', error);
    router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Satellite Dispatch Scan', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          className="flex-1 p-5" 
          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 400 : 40 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >

      {/* Header Section - Matching Odoo Wizard View */}
      <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
        <Text className="text-lg font-bold text-blue-900 mb-2">
              Satellite Dispatch Scan
        </Text>
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-blue-800 mr-2">Scanned:</Text>
          <Text className="text-lg font-bold text-blue-900">{baleCount}</Text>
          <Text className="text-base font-semibold text-blue-800 ml-1">bales</Text>
        </View>
      </View>

          {/* Barcode Input Section */}
      <View className="mb-4">
        <Text className="text-base font-semibold text-gray-700 mb-2">Barcode *</Text>
        <View className="flex-row items-center mb-3">
          <TextInput
            className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholder="Scan or enter barcode here..."
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => handleSaveBale()}
            autoFocus={true}
          />
          <TouchableOpacity
            onPress={() => {
              setScanningFor('barcode');
              setScannerVisible(true);
            }}
            className="p-3 ml-2 bg-gray-200 rounded-lg"
          >
            <Camera size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logistics Barcode Input Section */}
      <View className="mb-4">
        <Text className="text-base font-semibold text-gray-700 mb-2">Logistics Barcode *</Text>
        <View className="flex-row items-center">
          <TextInput
            className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholder="Enter logistics barcode..."
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
            value={logisticsBarcode}
            onChangeText={setLogisticsBarcode}
            onSubmitEditing={() => handleSaveBale()}
          />
          <TouchableOpacity
            onPress={() => {
              setScanningFor('logistics');
              setScannerVisible(true);
            }}
            className="p-3 ml-2 bg-gray-200 rounded-lg"
          >
            <Camera size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weight Input Section */}
      <View className="mb-4">
        <Text className="text-base font-semibold text-gray-700 mb-2">Weight (kg) *</Text>
        <TextInput
          className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
          placeholder="Enter weight in kg..."
          placeholderTextColor="#9CA3AF"
          style={{ color: '#111827' }}
          value={mass}
          onChangeText={setMass}
          keyboardType="numeric"
          onSubmitEditing={() => handleSaveBale()}
        />
      </View>

      {/* Message Section */}
      {message ? (
        <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: message.includes('successfully') ? '#d1fae5' : message.includes('Error') || message.includes('cannot') ? '#fee2e2' : '#fef3c7' }}>
              <Text
                className={`text-center text-base font-semibold ${
                  messageType === 'success'
                    ? 'text-green-800'
                    : messageType === 'error'
                    ? 'text-red-800'
                    : 'text-yellow-800'
                }`}
              >
            {message}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => {
            // Clear message immediately when Save Bale is clicked
            setMessage('');
            handleSaveBale();
          }}
          disabled={isSaving}
          className={`flex-1 p-4 rounded-lg items-center justify-center ${isSaving ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          <Text className="text-white font-bold text-lg">
            {isSaving ? 'Saving...' : 'Save Bale'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleDone}
          disabled={isSaving}
          className={`flex-1 p-4 rounded-lg items-center justify-center ${isSaving ? 'bg-green-400' : 'bg-green-600'}`}
        >
          <Text className="text-white font-bold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title={scanningFor === 'barcode' ? 'Scan Bale Barcode' : 'Scan Logistics Barcode'}
        />
      </Modal>
    </>
  );
};

export default SatelliteScanBalesScreen;
