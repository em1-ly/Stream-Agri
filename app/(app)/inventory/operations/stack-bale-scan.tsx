import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '../../../../components/BarcodeScanner';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

type MessageType = 'info' | 'success' | 'error';

// Stack bales scan screen – bale stacking variant of warehouse-bale-scan.
const StackBaleScanScreen = () => {
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
  const [stackedBales, setStackedBales] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [currentBaleId, setCurrentBaleId] = useState<string | null>(null);
  const [gradeMismatch, setGradeMismatch] = useState(false);
  const [showReclassifyButton, setShowReclassifyButton] = useState(false);
  const [showManualActions, setShowManualActions] = useState(false);

  const warehouseLabel = params.warehouseName || 'Warehouse';
  const locationLabel = params.locationName || 'Location';

  // Load initial stacked bale count
  useEffect(() => {
    const loadStackedCount = async () => {
      if (params.warehouseId && params.locationId) {
        try {
          const countResult = await powersync.getOptional<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM warehouse_shipped_bale 
             WHERE location_id = ? 
               AND warehouse_id = ?
               AND operation_type = 'stacking'`,
            [Number(params.locationId), Number(params.warehouseId)]
          );
          setStackedBales(countResult?.count || 0);
        } catch (error) {
          console.error('Failed to load stacked bale count:', error);
        }
      }
    };
    loadStackedCount();
  }, [params.warehouseId, params.locationId]);

  const handleScan = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!params.warehouseId || !params.locationId) {
      Alert.alert('Missing context', 'Warehouse or Location is missing. Go back and select them again.');
      return;
    }

    if (!effectiveBarcode) {
      setMessage('Please scan or enter bale barcode.');
      setMessageType('error');
      return;
    }

    setMessage('');
    setMessageType('info');

    try {
      // 1) Find the bale - must exist and be received (matching Odoo validation)
      const shippedBale = await powersync.getOptional<any>(
        `SELECT id, received, grade, location_id, warehouse_id
         FROM warehouse_shipped_bale
         WHERE barcode = ?
           AND warehouse_id = ?
         LIMIT 1`,
        [effectiveBarcode, Number(params.warehouseId)]
      );

      if (!shippedBale) {
        setMessage(`❌ Bale '${effectiveBarcode}' not found in received bales for warehouse ${warehouseLabel}.`);
        setMessageType('error');
        return;
      }

      if (!shippedBale.received) {
        setMessage(`❌ Bale '${effectiveBarcode}' is not yet received into warehouse stock.`);
        setMessageType('error');
        return;
      }

      // 2) Check if location has grade and validate grade mismatch (matching Odoo logic)
      const location = await powersync.getOptional<any>(
        `SELECT id, name, grade_id
         FROM warehouse_location
         WHERE id = ?
         LIMIT 1`,
        [Number(params.locationId)]
      );

      if (!location) {
        setMessage(`❌ Stack location not found.`);
        setMessageType('error');
        return;
      }

      // Grade validation (matching Odoo wizard logic)
      let gradeMismatch = false;
      let mismatchMessage = '';

      if (shippedBale.grade && location.grade_id) {
        if (Number(shippedBale.grade) !== Number(location.grade_id)) {
          gradeMismatch = true;
          const baleGrade = await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [shippedBale.grade]
          );
          const stackGrade = await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [location.grade_id]
          );
          mismatchMessage = `Grade mismatch: Bale is '${baleGrade?.name || 'Unknown'}' but stack is '${stackGrade?.name || 'Unknown'}'.`;
        }
      } else if (shippedBale.grade && !location.grade_id) {
        gradeMismatch = true;
        const baleGrade = await powersync.getOptional<any>(
          `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
          [shippedBale.grade]
        );
        mismatchMessage = `Grade mismatch: Bale has grade '${baleGrade?.name || 'Unknown'}' but stack has no grade.`;
      } else if (!shippedBale.grade && location.grade_id) {
        gradeMismatch = true;
        const stackGrade = await powersync.getOptional<any>(
          `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
          [location.grade_id]
        );
        mismatchMessage = `Grade mismatch: Bale has no grade but stack is '${stackGrade?.name || 'Unknown'}'.`;
      }

      if (gradeMismatch) {
        setMessage(mismatchMessage);
        setMessageType('error');
        setCurrentBaleId(shippedBale.id);
        setGradeMismatch(true);
        // Show reclassify button only if location has a grade_id
        setShowReclassifyButton(!!location.grade_id);
        return;
      }

      // Reset grade mismatch state if no mismatch
      setCurrentBaleId(null);
      setGradeMismatch(false);
      setShowReclassifyButton(false);

      // 3) Update the bale with stack information (offline-first)
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE warehouse_shipped_bale 
         SET location_id = ?,
             stack_date_time = ?,
             operation_type = 'stacking',
             write_date = ?
         WHERE id = ?`,
        [
          Number(params.locationId),
          now,
          now,
          shippedBale.id
        ]
      );

      // 4) Update UI
      setMessage(`✅ Bale '${effectiveBarcode}' assigned to stack '${location.name || locationLabel}'! Ready for next scan...`);
      setMessageType('success');
      setStackedBales((prev) => prev + 1);
      setBarcode('');
      setCurrentBaleId(null);
      setGradeMismatch(false);
      setShowReclassifyButton(false);

    } catch (error: any) {
      console.error('Stack bales scan error', error);
      const msg = error?.message || 'System error while scanning. Please try again.';
      setMessage(`❌ ${msg}`);
      setMessageType('error');
      setCurrentBaleId(null);
      setGradeMismatch(false);
      setShowReclassifyButton(false);
    }
  };

  const handleReclassifyAndAssign = async () => {
    if (!currentBaleId || !params.locationId) {
      Alert.alert('Error', 'No bale selected for reclassification or location missing.');
      return;
    }

    try {
      // Get location to get grade_id
      const location = await powersync.getOptional<any>(
        `SELECT id, name, grade_id
         FROM warehouse_location
         WHERE id = ?
         LIMIT 1`,
        [Number(params.locationId)]
      );

      if (!location || !location.grade_id) {
        Alert.alert('Error', 'Selected stack must have a grade for reclassification!');
        return;
      }

      // Get current bale grade for message
      const shippedBale = await powersync.getOptional<any>(
        `SELECT id, grade, barcode
         FROM warehouse_shipped_bale
         WHERE id = ?`,
        [currentBaleId]
      );

      if (!shippedBale) {
        Alert.alert('Error', 'Bale not found.');
        return;
      }

      const oldGrade = shippedBale.grade
        ? await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [shippedBale.grade]
          )
        : null;
      const newGrade = await powersync.getOptional<any>(
        `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
        [location.grade_id]
      );

      const oldGradeName = oldGrade?.name || 'No Grade';
      const newGradeName = newGrade?.name || 'Unknown';

      // Update the bale's grade to match the stack's grade
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE warehouse_shipped_bale 
         SET grade = ?,
             operation_type = 'reclassified_stacked',
             write_date = ?
         WHERE id = ?`,
        [Number(location.grade_id), now, currentBaleId]
      );

      // Reset grade mismatch flag
      setGradeMismatch(false);
      setShowReclassifyButton(false);

      // Now proceed with stacking
      await performStacking(currentBaleId, shippedBale.barcode, location);

      // Show success message
      setMessage(`✅ Grade changed from '${oldGradeName}' to '${newGradeName}' and bale stacked!`);
      setMessageType('success');
      setCurrentBaleId(null);
      setBarcode('');

    } catch (error: any) {
      console.error('Reclassify and assign error', error);
      const msg = error?.message || 'System error while reclassifying. Please try again.';
      setMessage(`❌ ${msg}`);
      setMessageType('error');
    }
  };

  const performStacking = async (baleId: string, barcodeValue: string, location: any) => {
    const now = new Date().toISOString();
    await powersync.execute(
      `UPDATE warehouse_shipped_bale 
       SET location_id = ?,
           stack_date_time = ?,
           operation_type = CASE 
             WHEN operation_type = 'reclassified_stacked' THEN 'reclassified_stacked'
             ELSE 'stacking'
           END,
           write_date = ?
       WHERE id = ?`,
      [
        Number(params.locationId),
        now,
        now,
        baleId
      ]
    );

    setStackedBales((prev) => prev + 1);
  };

  const handleNextScan = () => {
    // Reset all fields for next scan (matching Odoo action_next_scan)
    setBarcode('');
    setCurrentBaleId(null);
    setGradeMismatch(false);
    setShowReclassifyButton(false);
    setMessage('Scan a bale barcode and Stack.');
    setMessageType('info');
  };

  const handleDone = () => {
    router.back();
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    // 1) Hide instantly
    setScannerVisible(false);
    
    // 2) Defer
    setTimeout(() => {
      setShowManualActions(false);
      setBarcode(scannedCode);
      handleScan(scannedCode);
    }, 0);
  };

  const messageBg =
    messageType === 'success' ? 'bg-green-100' : messageType === 'error' ? 'bg-red-100' : 'bg-yellow-100';
  const messageText =
    messageType === 'success' ? 'text-green-800' : messageType === 'error' ? 'text-red-800' : 'text-yellow-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Stack Bales - Scan Bale', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white p-5"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Header info card – mirrors Odoo wizard alert */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Stack Bales</Text>
          <Text className="text-base text-blue-900">
            <Text className="font-semibold">Warehouse: </Text>
            {warehouseLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Location: </Text>
            {locationLabel}
          </Text>
          {/* Stacked count */}
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Bales Stacked: </Text>
            {stackedBales}
          </Text>
        </View>

        {/* Bale barcode input */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Bale Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or enter bale barcode..."
              value={barcode}
              onChangeText={setBarcode}
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              onSubmitEditing={() => handleScan()}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
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
          {showReclassifyButton ? (
            <TouchableOpacity
              onPress={handleReclassifyAndAssign}
              className="flex-1 bg-orange-600 p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">Reclassify & Assign</Text>
            </TouchableOpacity>
          ) : (
            showManualActions && (
            <TouchableOpacity
              onPress={() => handleScan()}
              className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">Assign Stack</Text>
            </TouchableOpacity>
            )
          )}
        </View>

        <View className="mt-3 flex-row gap-3">
          {gradeMismatch && (
            <TouchableOpacity
              onPress={handleNextScan}
              className="flex-1 bg-blue-600 p-3 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-semibold">Next Scan</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Stacking Complete',
                `✅ Bales stacked: ${stackedBales}\n🏭 Warehouse: ${warehouseLabel}\n📦 Location: ${locationLabel}`,
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
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Rack Barcode"
        />
      </Modal>
    </>
  );
};

export default StackBaleScanScreen;


