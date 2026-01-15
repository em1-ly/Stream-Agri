import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { useSession } from '@/authContext';
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

const WarehouseBaleScanScreen = () => {
  const router = useRouter();
  const { session } = useSession();
  const params = useLocalSearchParams<{
    warehouseId?: string;
    locationId?: string;
    warehouseName?: string;
    locationName?: string;
  }>();

  const [receivingMode, setReceivingMode] = useState<'by_bale' | 'by_pallet'>('by_bale');
  const [barcode, setBarcode] = useState('');
  const [logisticsBarcode, setLogisticsBarcode] = useState('');
  const [receivedMass, setReceivedMass] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [scannedBales, setScannedBales] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'product' | 'logistics'>('product');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const massInputRef = useRef<TextInput>(null);

  // Initial count of scanned bales in this location
  useEffect(() => {
    const fetchInitialCount = async () => {
      if (params.warehouseId && params.locationId) {
        try {
          const countResult = await powersync.getOptional<{count: number}>(
            `SELECT count(*) as count FROM warehouse_shipped_bale 
             WHERE received = 1 AND warehouse_id = ? AND location_id = ?`,
            [Number(params.warehouseId), Number(params.locationId)]
          );
          if (countResult) {
            setScannedBales(countResult.count);
          }
        } catch (error) {
          console.error('Error fetching initial scanned bales count:', error);
        }
      }
    };
    fetchInitialCount();
  }, [params.warehouseId, params.locationId]);

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

  const warehouseLabel = params.warehouseName || 'Warehouse';
  const locationLabel = params.locationName || 'Location';

  const handleScan = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!params.warehouseId || !params.locationId) {
      Alert.alert('Missing context', 'Warehouse or Location is missing. Go back and select them again.');
      return;
    }

    if (receivingMode === 'by_bale' && !effectiveBarcode) {
      setMessage('Please scan or enter a product barcode.');
      setMessageType('error');
      return;
    }

    // Offline validation using mirror tables before hitting the API
    try {
      if (receivingMode === 'by_bale') {
        // 1) Resolve shipped bale by barcode/logistics_barcode
        const shipped = await powersync.getOptional<any>(
          `SELECT id, received, stock_status
           FROM warehouse_shipped_bale
           WHERE barcode = ? OR logistics_barcode = ?
           LIMIT 1`,
          [effectiveBarcode, effectiveBarcode]
        );

        if (!shipped) {
          setMessage(`❌ Bale '${effectiveBarcode}' not found in shipped bales.`);
          setMessageType('error');
          return;
        }

        if (shipped.received) {
          setMessage(`❌ Bale '${effectiveBarcode}' is already received in warehouse stock.`);
          setMessageType('error');
          return;
        }
      } else if (receivingMode === 'by_pallet') {
        // Pallet/Rack validation
        const pallet = await powersync.getOptional<any>(
          `SELECT id, pallet_capacity, current_load
           FROM warehouse_pallet
           WHERE barcode = ? OR logistics_barcode = ?
           LIMIT 1`,
          [effectiveBarcode, effectiveBarcode]
        );

        if (!pallet) {
          setMessage(`❌ Pallet '${effectiveBarcode}' not found.`);
          setMessageType('error');
          return;
        }

        if (
          typeof pallet.pallet_capacity === 'number' &&
          typeof pallet.current_load === 'number' &&
          pallet.pallet_capacity > 0 &&
          pallet.current_load >= pallet.pallet_capacity
        ) {
          setMessage(
            `❌ Pallet is full (${pallet.current_load}/${pallet.pallet_capacity} products).`
          );
          setMessageType('error');
          return;
        }
      }
    } catch (offlineError) {
      console.warn('⚠️ Offline validation error (proceeding to server validation):', offlineError);
      // Do not return; let server-side wizard validate as a fallback.
    }

    try {
      const now = new Date().toISOString();
      const userId = (session as any)?.userId ?? (session as any)?.uid;

      if (receivingMode === 'by_bale') {
        await powersync.execute(
          `UPDATE warehouse_shipped_bale SET 
             received = 1, 
             received_mass = ?, 
             location_id = ?, 
             warehouse_id = ?,
             received_date_time = ?,
             received_by = ?,
             logistics_barcode = COALESCE(?, logistics_barcode),
             write_date = ?
           WHERE barcode = ? OR logistics_barcode = ?`,
          [
            receivedMass ? Number(receivedMass) : null,
            Number(params.locationId),
            Number(params.warehouseId),
            now,
            userId,
            logisticsBarcode || null,
            now,
            effectiveBarcode,
            effectiveBarcode
          ]
        );
      } else if (receivingMode === 'by_pallet') {
        const pallet = await powersync.getOptional<any>(
          `SELECT id FROM warehouse_pallet WHERE barcode = ? OR logistics_barcode = ? LIMIT 1`,
          [effectiveBarcode, effectiveBarcode]
        );

        if (pallet) {
          // 1. Update the pallet
          await powersync.execute(
            `UPDATE warehouse_pallet SET 
               location_id = ?, 
               warehouse_id = ?,
               write_date = ?
             WHERE id = ?`,
            [Number(params.locationId), Number(params.warehouseId), now, pallet.id]
          );

          // 2. Update all bales on this pallet
          await powersync.execute(
            `UPDATE warehouse_shipped_bale SET 
               received = 1, 
               location_id = ?, 
               warehouse_id = ?,
               received_date_time = ?,
               received_by = ?,
               write_date = ?
             WHERE pallet_id = ?`,
            [Number(params.locationId), Number(params.warehouseId), now, userId, now, pallet.id]
          );
        }
      }

      // Refresh scanned count
      const countResult = await powersync.get<{count: number}>(
        `SELECT count(*) as count FROM warehouse_shipped_bale 
         WHERE received = 1 AND warehouse_id = ? AND location_id = ?`,
        [Number(params.warehouseId), Number(params.locationId)]
      );
      setScannedBales(countResult.count);

      setMessage(`✅ ${receivingMode === 'by_pallet' ? 'Pallet' : 'Product'} '${effectiveBarcode}' received successfully.`);
      setMessageType('success');

      // Clear only the barcode fields to allow rapid scanning
      setBarcode('');
      setLogisticsBarcode('');
      setReceivedMass('');

      // Automatically open camera for next scan
      setTimeout(() => {
        Keyboard.dismiss();
        setScannerTarget('product');
        setScannerVisible(true);
      }, 300);

    } catch (error: any) {
      console.error('Receiving scan error', error);
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'System error while scanning. Please try again.';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const handleDone = () => {
    router.back();
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    // 1) Hide the scanner instantly for better UX
    setScannerVisible(false);
    
    // 2) Defer processing
    setTimeout(() => {
    // Just populate the field, don't auto-save
      if (scannerTarget === 'product') {
        setBarcode(scannedCode);
      setReceivedMass(''); // Clear mass when scanning a new barcode
      // Focus the mass field after a short delay
      setTimeout(() => {
        massInputRef.current?.focus();
      }, 100);
      } else {
        setLogisticsBarcode(scannedCode);
      }
    }, 0);
  };

  const messageBg =
    messageType === 'success' ? 'bg-green-100' : messageType === 'error' ? 'bg-red-100' : 'bg-yellow-100';
  const messageText =
    messageType === 'success' ? 'text-green-800' : messageType === 'error' ? 'text-red-800' : 'text-yellow-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Scan Complete Receipt', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title={scannerTarget === 'product' ? 'Scan Product Barcode' : 'Scan Logistics Barcode'}
        />
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white p-5"
          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 400 : 40 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
        {/* Header info card – mirrors Odoo wizard alert */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Complete Receipt</Text>
          <Text className="text-base text-blue-900">
            <Text className="font-semibold">Warehouse: </Text>
            {warehouseLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Location: </Text>
            {locationLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Scanned: </Text>
            {scannedBales} products
          </Text>
        </View>

        {/* Receiving mode – radio style toggle */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-2">Receiving Mode</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
                receivingMode === 'by_bale' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
              }`}
              onPress={() => setReceivingMode('by_bale')}
            >
              <View className="mr-2">
                <View
                  className={`w-4 h-4 rounded-full border-2 ${
                    receivingMode === 'by_bale' ? 'border-blue-600' : 'border-gray-400'
                  } items-center justify-center`}
                >
                  {receivingMode === 'by_bale' && (
                    <View className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Scan Individual Products</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
                receivingMode === 'by_pallet' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
              }`}
              onPress={() => setReceivingMode('by_pallet')}
            >
              <View className="mr-2">
                <View
                  className={`w-4 h-4 rounded-full border-2 ${
                    receivingMode === 'by_pallet' ? 'border-blue-600' : 'border-gray-400'
                  } items-center justify-center`}
                >
                  {receivingMode === 'by_pallet' && (
                    <View className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Scan by Racks</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barcode + optional fields */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or enter barcode here..."
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              value={barcode}
              onChangeText={setBarcode}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setScannerTarget('product');
                setScannerVisible(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {receivingMode === 'by_bale' && (
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Logistics Barcode</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Optional logistics barcode..."
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                value={logisticsBarcode}
                onChangeText={setLogisticsBarcode}
              />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScannerTarget('logistics');
                  setScannerVisible(true);
                }}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {receivingMode === 'by_bale' && (
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Received Mass (kg)</Text>
            <TextInput
              ref={massInputRef}
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="0.0"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              keyboardType="numeric"
              value={receivedMass}
              onChangeText={setReceivedMass}
            />
          </View>
        )}

        {/* Message area */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Footer buttons – mirror wizard footer */}
        <View className="mt-2 flex-row gap-3">
          <TouchableOpacity
            onPress={() => handleScan()}
            className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">
              {receivingMode === 'by_pallet' ? 'Receive Pallet' : 'Save Product'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row gap-3">
          <TouchableOpacity
            onPress={handleDone}
            className="flex-1 bg-green-600 p-3 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-semibold">Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-1 bg-gray-200 p-3 rounded-lg items-center justify-center"
          >
            <Text className="text-gray-800 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default WarehouseBaleScanScreen;


