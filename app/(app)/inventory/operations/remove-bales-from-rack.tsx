import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

type MessageType = 'info' | 'success' | 'error';

// Rack loading scan screen – pallet-only variant of warehouse-bale-scan.
const RemoveBalesFromRackScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    warehouseId?: string;
    locationId?: string;
    warehouseName?: string;
    locationName?: string;
  }>();

  const [barcode, setBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [depalletizedBales, setDepalletizedBales] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [showManualActions, setShowManualActions] = useState(false);

  const warehouseLabel = params.warehouseName || 'Warehouse';
  const locationLabel = params.locationName || 'Location';

  useEffect(() => {
    // Auto-open scanner
    setTimeout(() => {
      setScannerVisible(false);
    }, 300);
  }, []);

  const handleScan = async (overrideBarcode?: string) => {
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!effectiveBarcode) {
      setMessage('Please scan or enter bale barcode.');
      setMessageType('error');
      setScanStatus('error');
      return;
    }

    setScanStatus('processing');
    setLastScannedBarcode(effectiveBarcode);

    try {
      // Validate bale exists and is on a rack
      const shipped = await powersync.getOptional<any>(
        `SELECT id, pallet_id, received, warehouse_id, location_id
         FROM warehouse_shipped_bale
         WHERE barcode = ?
         LIMIT 1`,
        [effectiveBarcode]
      );

      if (!shipped) {
        setMessage(`❌ Bale '${effectiveBarcode}' not found in shipped bales.`);
        setMessageType('error');
        setScanStatus('error');
        return;
      }

      if (!shipped.received) {
        setMessage(`❌ Bale '${effectiveBarcode}' is not yet received.`);
        setMessageType('error');
        setScanStatus('error');
        return;
      }

      if (!shipped.pallet_id) {
        setMessage(`❌ Bale '${effectiveBarcode}' is not on any rack.`);
        setMessageType('error');
        setScanStatus('error');
        return;
      }

      // Remove bale from rack locally
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE warehouse_shipped_bale
         SET pallet_id = NULL,
             operation_type = 'deracked',
             write_date = ?
         WHERE id = ?`,
        [now, shipped.id]
      );

      // Decrement pallet load if we know the pallet
      try {
        await powersync.execute(
          `UPDATE warehouse_pallet
           SET current_load = CASE WHEN current_load > 0 THEN current_load - 1 ELSE 0 END,
               write_date = ?
           WHERE id = ?`,
          [now, shipped.pallet_id]
        );
      } catch (palletErr) {
        console.warn('⚠️ Could not decrement pallet load locally:', palletErr);
      }

      setDepalletizedBales((prev) => prev + 1);
      setMessage(`✅ Bale '${effectiveBarcode}' removed from rack.`);
      setMessageType('success');
      setScanStatus('success');
      setBarcode('');
      
      // Reset status after showing success message
      setTimeout(() => {
        setScanStatus('idle');
        setMessage('');
        setLastScannedBarcode('');
      }, 2000);
    } catch (error: any) {
      console.error('Depalletize scan error', error);
      const msg = error?.message || 'System error while removing bale. Please try again.';
      setMessage(msg);
      setMessageType('error');
      setScanStatus('error');
    }
  };

  const handleDone = () => {
    router.back();
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    // Keep scanner open and process the barcode
    setShowManualActions(false);
    handleScan(scannedCode);
  };

  const messageBg =
    messageType === 'success' ? 'bg-green-100' : messageType === 'error' ? 'bg-red-100' : 'bg-yellow-100';
  const messageText =
    messageType === 'success' ? 'text-green-800' : messageType === 'error' ? 'text-red-800' : 'text-yellow-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Remove Bales from Rack', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Bale Barcode"
          stayOnCamera={true}
          scanStatus={scanStatus}
          subtitle={message || undefined}
          displayInfo={{
            barcode: lastScannedBarcode,
            progress: { scanned: depalletizedBales, total: 0 }
          }}
        />
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white p-5"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header info card – mirrors Odoo wizard alert */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
         
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Removed From Rack: </Text>
            {depalletizedBales}
          </Text>
        </View>

        {/* Rack barcode input */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Bale Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or enter rack barcode..."
              value={barcode}
              onChangeText={setBarcode}
              autoFocus
              onSubmitEditing={() => handleScan()}
            />
            <TouchableOpacity
              onPress={() => {
                setScannerVisible(true);
                setShowManualActions(false);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setScannerVisible(false);
                setShowManualActions(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <KeyboardIcon size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message area */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Footer buttons */}
        <View className="mt-2 flex-row gap-3">
          {showManualActions && (
            <TouchableOpacity
              onPress={() => handleScan()}
              className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">Remove From Rack</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-3 flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Removal Complete',
                `✅ Bales removed: ${depalletizedBales}`,
                [
                  {
                    text: 'OK',
                    onPress: () => handleDone(),
                  },
                ]
              );
            }}
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

export default RemoveBalesFromRackScreen;


