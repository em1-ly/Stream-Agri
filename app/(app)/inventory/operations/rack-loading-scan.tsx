import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { v4 as uuidv4 } from 'uuid';

type MessageType = 'info' | 'success' | 'error';

// Rack loading scan screen – handles both rack scanning and bale scanning
const RackLoadingScanScreen = () => {
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
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [showManualActions, setShowManualActions] = useState(false);
  
  // Rack scanning state
  const [currentPalletId, setCurrentPalletId] = useState<string | null>(null);
  const [currentPalletBarcode, setCurrentPalletBarcode] = useState<string>('');
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [scannedRackBarcode, setScannedRackBarcode] = useState<string>('');
  const [scanningMode, setScanningMode] = useState<'rack' | 'bale'>('rack');
  
  // Create rack modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gradeId, setGradeId] = useState<string>('');
  const [palletCapacityInput, setPalletCapacityInput] = useState<string>('12');
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [gradeSearchText, setGradeSearchText] = useState<string>('');
  
  // Bale scanning state
  const [baleCount, setBaleCount] = useState(0);
  const [palletCapacity, setPalletCapacity] = useState(0);
  const [palletFull, setPalletFull] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [rackBarcodes, setRackBarcodes] = useState<string[]>([]);
  const [showRackBarcodesModal, setShowRackBarcodesModal] = useState(false);
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

  // Use a small celebratory icon for success states
  const displayMessage = messageType === 'success' && message ? `🌈 ${message}` : message;

  const warehouseLabel = params.warehouseName || 'Warehouse';
  const locationLabel = params.locationName || 'Location';

  // Load grades for create rack modal
  useEffect(() => {
    const loadGrades = async () => {
      try {
        const gradeRows = await powersync.getAll<any>(
          `SELECT id, name FROM warehouse_bale_grade ORDER BY name`
        );
        setGrades(gradeRows || []);
      } catch (error) {
        console.error('Failed to load grades:', error);
      }
    };
    if (showCreateModal) {
      loadGrades();
    }
  }, [showCreateModal]);

  // Load bale count from DB when in bale scanning mode
  useEffect(() => {
    const loadBaleCount = async () => {
      if (scanningMode === 'bale' && currentPalletId) {
        try {
          const countResult = await powersync.getOptional<{ count: number }>(
            `SELECT COUNT(*) as count FROM warehouse_shipped_bale WHERE pallet_id = ?`,
            [currentPalletId]
          );
          const count = countResult?.count || 0;
          setBaleCount(count);
          setPalletFull(count >= palletCapacity);
        } catch (error) {
          console.error('Failed to load bale count:', error);
        }
      }
    };
    loadBaleCount();
  }, [scanningMode, currentPalletId, palletCapacity]);

  const handleRackScan = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!params.warehouseId || !params.locationId) {
      Alert.alert('Missing context', 'Warehouse or Location is missing. Go back and select them again.');
      return;
    }

    if (!effectiveBarcode) {
      setMessage('Please scan or enter a rack barcode.');
      setMessageType('error');
      return;
    }

    // Offline-only validation using warehouse_pallet
    try {
      const pallet = await powersync.getOptional<any>(
        `SELECT id, pallet_capacity, current_load
         FROM warehouse_pallet
         WHERE (barcode = ? OR logistics_barcode = ?)
           AND warehouse_id = ?
         LIMIT 1`,
        [effectiveBarcode, effectiveBarcode, Number(params.warehouseId)]
      );

      if (!pallet) {
        setMessage(`❌ Rack '${effectiveBarcode}' not found. You can create a new rack with this barcode.`);
        setMessageType('info');
        setShowCreateButton(true);
        setScannedRackBarcode(effectiveBarcode);
        setBarcode('');
        return;
      }

      if (
        typeof pallet.pallet_capacity === 'number' &&
        typeof pallet.current_load === 'number' &&
        pallet.pallet_capacity > 0 &&
        pallet.current_load >= pallet.pallet_capacity
      ) {
        setMessage(
          `❌ Rack is full (${pallet.current_load}/${pallet.pallet_capacity} products). Please scan another rack.`
        );
        setMessageType('error');
        setBarcode('');
        return;
      }

      // Rack found and not full - proceed to bale scanning
      setCurrentPalletId(pallet.id);
      setCurrentPalletBarcode(effectiveBarcode);
      setPalletCapacity(pallet.pallet_capacity || 0);
      setBaleCount(pallet.current_load || 0);
      setPalletFull((pallet.current_load || 0) >= (pallet.pallet_capacity || 0));
      setScanningMode('bale');
      setMessage(`✅ Rack '${effectiveBarcode}' ready. Scan bales to add to rack.`);
      setMessageType('success');
      setBarcode('');
      setShowCreateButton(false);
      } catch (error: any) {
        console.error('Rack loading scan error', error);
      setMessage('Error accessing local database. Please try again.');
        setMessageType('error');
    }
  };

  const handleBaleScan = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!currentPalletId || !params.warehouseId || !params.locationId) {
      Alert.alert('Missing context', 'Rack, Warehouse or Location is missing.');
      return;
    }

    if (!effectiveBarcode) {
      setMessage('Please scan or enter a bale barcode.');
      setMessageType('error');
      return;
    }

    // Check if rack is full
    if (palletFull) {
      setMessage(`❌ Rack is full! Capacity: ${palletCapacity}, Current: ${baleCount}. Please scan next rack.`);
      setMessageType('error');
      setBarcode('');
      return;
    }

    try {
      // Offline validation
      const shippedBale = await powersync.getOptional<any>(
        `SELECT id, barcode, grade, pallet_id, received
         FROM warehouse_shipped_bale
         WHERE barcode = ?
         LIMIT 1`,
        [effectiveBarcode]
      );

      if (!shippedBale) {
        setMessage(`❌ Bale with barcode '${effectiveBarcode}' not found in shipped bales!`);
        setMessageType('error');
        setBarcode('');
        return;
      }

      // Check if bale is already received
      if (!shippedBale.received) {
        setMessage(`❌ Bale '${effectiveBarcode}' is not yet received!`);
        setMessageType('error');
        setBarcode('');
        return;
      }

      // Check if bale is already on this rack
      if (shippedBale.pallet_id && String(shippedBale.pallet_id) === currentPalletId) {
        setMessage(`❌ Bale ${effectiveBarcode} is already in this rack!`);
        setMessageType('error');
        setBarcode('');
        return;
      }

      // Check grade match with rack
      const pallet = await powersync.getOptional<any>(
        `SELECT id, grade_id
         FROM warehouse_pallet
         WHERE id = ?
         LIMIT 1`,
        [currentPalletId]
      );

      if (pallet && pallet.grade_id && shippedBale.grade) {
        if (String(shippedBale.grade) !== String(pallet.grade_id)) {
          const baleGrade = await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [shippedBale.grade]
          );
          const rackGrade = await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [pallet.grade_id]
          );
          setMessage(
            `❌ Bale grade '${baleGrade?.name || shippedBale.grade}' does not match rack grade '${rackGrade?.name || pallet.grade_id}'!`
          );
          setMessageType('error');
          setBarcode('');
          return;
        }
      }

      // Update bale offline-first
      const now = new Date().toISOString();

      await powersync.execute(
        `UPDATE warehouse_shipped_bale 
         SET pallet_id = ?,
             location_id = ?,
             warehouse_id = ?,
             operation_type = 'racked',
             write_date = ?
         WHERE id = ?`,
        [currentPalletId, Number(params.locationId), Number(params.warehouseId), now, shippedBale.id]
      );

      // Update pallet current_load
      await powersync.execute(
        `UPDATE warehouse_pallet
         SET current_load = current_load + 1,
             write_date = ?
         WHERE id = ?`,
        [now, currentPalletId]
      );

      // Success - refresh count from DB and clear fields
      const countResult = await powersync.getOptional<{ count: number }>(
        `SELECT COUNT(*) as count FROM warehouse_shipped_bale WHERE pallet_id = ?`,
        [currentPalletId]
      );
      const newCount = countResult?.count || baleCount + 1;
      setBaleCount(newCount);
      setPalletFull(newCount >= palletCapacity);
      setMessage(`✅ Bale '${effectiveBarcode}' received and added to rack! (${newCount}/${palletCapacity})`);
      setMessageType('success');
      setBarcode('');

      // If rack is now full, show message
      if (newCount >= palletCapacity) {
        setTimeout(() => {
          setMessage(`⚠️ Rack is now full! Please scan next rack.`);
          setMessageType('info');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Bale scan error', error);
      const msg = error?.message || 'System error while scanning bale. Please try again.';
      setMessage(`❌ ${msg}`);
      setMessageType('error');
    }
  };

  const handleScan = async (overrideBarcode?: string) => {
    if (scanningMode === 'rack') {
      await handleRackScan(overrideBarcode);
    } else {
      await handleBaleScan(overrideBarcode);
    }
  };

  const handleCreateRack = async () => {
    if (!scannedRackBarcode || !params.warehouseId || !gradeId) {
      Alert.alert('Missing Information', 'Please select a grade to create the rack.');
      return;
    }

    const capacity = parseInt(palletCapacityInput, 10);
    if (!capacity || capacity <= 0) {
      Alert.alert('Invalid Capacity', 'Please enter a valid rack capacity (greater than 0).');
      return;
    }

    try {
      // 1) Check for existing rack locally before creating to prevent duplication
      const existingPallet = await powersync.getOptional<any>(
        'SELECT id FROM warehouse_pallet WHERE barcode = ? LIMIT 1',
        [scannedRackBarcode]
      );

      if (existingPallet) {
        Alert.alert('Duplicate Rack', `A rack with barcode '${scannedRackBarcode}' already exists in the system.`);
        setShowCreateModal(false);
        setScannedRackBarcode('');
        return;
      }

      // 2) Offline-first: Insert into local database
      const localId = uuidv4();
      const now = new Date().toISOString();

      await powersync.execute(
        `INSERT INTO warehouse_pallet (
          id, 
          warehouse_id, 
          location_id, 
          barcode, 
          grade_id, 
          pallet_capacity, 
          current_load,
          create_date,
          write_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localId,
          Number(params.warehouseId),
          params.locationId ? Number(params.locationId) : null,
          scannedRackBarcode,
          Number(gradeId),
          capacity,
          0, // Initial load is 0
          now,
          now
        ]
      );

      // Rack created successfully locally - switch to bale scanning mode
      setCurrentPalletId(localId);
        setCurrentPalletBarcode(scannedRackBarcode);
        setPalletCapacity(capacity);
        setBaleCount(0);
        setPalletFull(false);
        setScanningMode('bale');
        setShowCreateButton(false);
        setShowCreateModal(false);
        setScannedRackBarcode('');
        setGradeId('');
        setPalletCapacityInput('12');
        setGradeSearchText('');
      setMessage(`✅ Rack '${scannedRackBarcode}' created successfully (offline). Scan bales to add to rack.`);
        setMessageType('success');

    } catch (error: any) {
      console.error('Create rack error', error);
      const msg = error?.message || 'System error while creating rack locally. Please try again.';
      setMessage(`❌ ${msg}`);
      setMessageType('error');
    }
  };

  const handleNextRack = () => {
    setScanningMode('rack');
    setCurrentPalletId(null);
    setCurrentPalletBarcode('');
    setBaleCount(0);
    setPalletCapacity(0);
    setPalletFull(false);
    setBarcode('');
    setMessage('Scan a rack barcode to start receiving bales.');
    setMessageType('info');
    setShowCreateButton(false);
    setScannedRackBarcode('');
  };

  const handleDone = () => {
    router.back();
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    setLastScannedBarcode(scannedCode);
    setShowManualActions(false);
    
    // Keep camera open for bale loading; close for rack scanning
    if (scanningMode === 'rack') {
      setScannerVisible(false);
    }
    
    setTimeout(() => {
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
      <Stack.Screen
        options={{
          title: scanningMode === 'rack' ? 'Rack Loading - Scan Rack' : 'Rack Loading - Scan Bales',
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 p-5"
          contentContainerStyle={{ 
            flexGrow: 1,
            paddingBottom: isKeyboardVisible ? 400 : 100 
          }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          {/* Header info card */}
          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">Rack Loading</Text>
            <Text className="text-base text-blue-900">
              <Text className="font-semibold">Warehouse: </Text>
              {warehouseLabel}
            </Text>
            <Text className="text-base text-blue-900 mt-1">
              <Text className="font-semibold">Location: </Text>
              {locationLabel}
            </Text>
            {scanningMode === 'bale' && currentPalletId && (
              <>
                <Text className="text-base text-blue-900 mt-1">
                  <Text className="font-semibold">Bales on Rack: </Text>
                  {baleCount}/{palletCapacity}
                </Text>
                {palletFull && (
                  <Text className="text-base text-red-700 mt-1 font-semibold">⚠️ Rack is Full!</Text>
                )}
              </>
            )}
          </View>

          {/* Barcode input */}
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">
              {scanningMode === 'rack' ? 'Rack Barcode' : 'Bale Barcode'}
            </Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder={scanningMode === 'rack' ? 'Scan or enter rack barcode...' : 'Scan or enter bale barcode...'}
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={() => handleScan()}
              />
            <View className="flex-row">
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
          </View>

          {/* Message area */}
          {displayMessage ? (
            <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
              <Text className={`text-base font-semibold ${messageText}`}>{displayMessage}</Text>
            </View>
          ) : null}

          {/* Footer buttons */}
          <View className="mt-2 flex-row gap-3">
            {showManualActions && (
            <TouchableOpacity
              onPress={() => handleScan()}
              className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">
                {scanningMode === 'rack' ? 'Scan Rack' : 'Add Bale'}
              </Text>
            </TouchableOpacity>
            )}
          </View>

          {/* Create Rack button (shown when rack not found) */}
          {showCreateButton && scanningMode === 'rack' && (
            <View className="mt-3">
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                className="bg-blue-600 p-4 rounded-lg items-center justify-center"
              >
                <Text className="text-white font-bold text-lg">Create New Rack</Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="mt-3 flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Rack Loading Summary',
                  `Rack: ${currentPalletBarcode || currentPalletId || 'N/A'}\n` +
                    `Bales on Rack: ${baleCount}/${palletCapacity || 0}\n` +
                    `Mode: ${scanningMode === 'bale' ? 'Bale scanning' : 'Rack scanning'}\n` +
                    `Barcodes: ${rackBarcodes.length > 0 ? `${rackBarcodes.length} scanned (tap Show Barcodes to view)` : 'None'}`,
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
        <View className="flex-1 bg-black">
          {scanningMode === 'bale' ? (
            <>
              <BarcodeScanner
                onBarcodeScanned={handleBarcodeScanned}
                onClose={() => setScannerVisible(false)}
                scanType="bale"
                stayOnCamera={true}
                title="Scan Bale Barcode"
                subtitle={message || 'Position the barcode within the frame'}
                scanStatus={messageType === 'success' ? 'success' : messageType === 'error' ? 'error' : 'idle'}
              />
              {/* Information overlay below header icons */}
              <View className="absolute top-24 left-0 right-0 p-4 bg-black/70">
                {lastScannedBarcode ? (
                  <Text className="text-white text-base mb-1 font-semibold">
                    Barcode: {lastScannedBarcode}
                  </Text>
                ) : null}
                <Text className="text-white text-sm mb-2">
                  Bales on Rack: {baleCount}/{palletCapacity || 0}
                </Text>
                {displayMessage ? (
                  <Text
                    className={`text-sm ${
                      messageType === 'success'
                        ? 'text-green-300'
                        : messageType === 'error'
                        ? 'text-red-300'
                        : 'text-blue-200'
                    }`}
                  >
                    {displayMessage}
                  </Text>
                ) : null}
              </View>
            </>
          ) : (
            <BarcodeScanner
              onBarcodeScanned={handleBarcodeScanned}
              onClose={() => setScannerVisible(false)}
              scanType="bale"
              title="Scan Rack Barcode"
            />
          )}
        </View>
      </Modal>

      {/* Rack Barcodes Modal */}
      <Modal
        visible={showRackBarcodesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRackBarcodesModal(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="bg-white rounded-t-2xl max-h-[70%] p-5"
          >
            <Text className="text-lg font-bold text-[#65435C] mb-3">
              Rack Barcodes {currentPalletBarcode ? `(${currentPalletBarcode})` : ''}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {rackBarcodes.length === 0 ? (
                <Text className="text-gray-600 text-center py-4">No barcodes found on this rack.</Text>
              ) : (
                rackBarcodes.map((code, idx) => (
                  <View key={`${code}-${idx}`} className="py-2 border-b border-gray-200">
                    <Text className="text-base text-gray-900">{code}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View className="mt-4">
              <TouchableOpacity
                onPress={() => setShowRackBarcodesModal(false)}
                className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
              >
                <Text className="text-white font-bold text-lg">Close</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create Rack Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="bg-white rounded-t-2xl max-h-[80%] p-5"
          >
            <Text className="text-lg font-bold text-[#65435C] mb-4">Create New Rack</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View className="mb-4">
                <Text className="text-gray-800 font-semibold mb-1">Rack Barcode</Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                  style={{ color: '#111827' }}
                  value={scannedRackBarcode}
                  editable={false}
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-800 font-semibold mb-1">Grade *</Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base mb-2"
                  placeholder="Search or type grade name..."
                  placeholderTextColor="#9CA3AF"
                  style={{ color: '#111827' }}
                  value={gradeSearchText}
                  onChangeText={(text) => {
                    setGradeSearchText(text);
                    // Clear selection if user starts typing a different grade
                    if (gradeId && text !== grades.find((g) => g.id === gradeId)?.name) {
                      setGradeId('');
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                
                {!gradeId && (
                  <>
                    <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
                      {grades
                        .filter((grade) =>
                          grade.name.toLowerCase().includes(gradeSearchText.toLowerCase())
                        )
                        .map((grade) => (
                          <TouchableOpacity
                            key={grade.id}
                            className="p-3 border-b border-gray-200 bg-white"
                            onPress={() => {
                              setGradeId(grade.id);
                              setGradeSearchText(grade.name);
                            }}
                          >
                            <Text className="text-base text-gray-900">{grade.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {grades.filter((grade) =>
                      grade.name.toLowerCase().includes(gradeSearchText.toLowerCase())
                    ).length === 0 && gradeSearchText && (
                      <Text className="text-gray-500 text-center py-4">
                        No grades found matching your search
                      </Text>
                    )}
                  </>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-gray-800 font-semibold mb-1">Rack Capacity *</Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                  placeholder="Enter rack capacity (default: 12)"
                  placeholderTextColor="#9CA3AF"
                  style={{ color: '#111827' }}
                  value={palletCapacityInput}
                  onChangeText={setPalletCapacityInput}
                  keyboardType="numeric"
                />
              </View>

              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCreateRack}
                  className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
                  disabled={!gradeId || !palletCapacityInput}
                >
                  <Text className="text-white font-bold text-lg">Create Rack</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowCreateModal(false);
                    setGradeId('');
                    setPalletCapacityInput('12');
                    setGradeSearchText('');
                  }}
                  className="flex-1 bg-gray-200 p-4 rounded-lg items-center justify-center"
                >
                  <Text className="text-gray-800 font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

export default RackLoadingScanScreen;
