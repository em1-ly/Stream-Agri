import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type State = 'input' | 'ready_to_scan' | 'done';

interface BaleSequencingInfo {
  id: string;
  barcode: string;
  row: number;
  lay: string;
  sequence: number;
  selling_point_id: number;
  selling_point_name?: string;
  floor_sale_id: number;
  floor_sale_name?: string;
  grower_number?: string;
}

const BaleResequencingScreen = () => {
  const router = useRouter();
  const [state, setState] = useState<State>('input');
  const [lastBaleBarcode, setLastBaleBarcode] = useState('');
  const [balesToSkipCount, setBalesToSkipCount] = useState('1');
  const [baleBarcodeToScan, setBaleBarcodeToScan] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [scannedCount, setScannedCount] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanningFor, setScanningFor] = useState<'last_bale' | 'missed_bale'>('last_bale');
  const [showManualActions, setShowManualActions] = useState(false);

  // Auto-populated fields from last bale
  const [sequencingInfo, setSequencingInfo] = useState<BaleSequencingInfo | null>(null);
  const [startSequence, setStartSequence] = useState<number | null>(null);

  // Load sequencing info when last bale barcode is entered
  useEffect(() => {
    const loadSequencingInfo = async () => {
      if (!lastBaleBarcode) {
        setSequencingInfo(null);
        setMessage('');
        return;
      }

      try {
        const info = await powersync.getOptional<BaleSequencingInfo>(
          `SELECT 
            bs.id,
            bs.barcode,
            bs.row,
            bs.lay,
            bs.sequence,
            bs.selling_point_id,
            sp.name as selling_point_name,
            bs.floor_sale_id,
            fs.name as floor_sale_name,
            bs.grower_number
           FROM receiving_curverid_bale_sequencing_model bs
           LEFT JOIN floor_maintenance_selling_point sp ON bs.selling_point_id = sp.id
           LEFT JOIN floor_maintenance_floor_sale fs ON bs.floor_sale_id = fs.id
           WHERE bs.barcode = ?
           LIMIT 1`,
          [lastBaleBarcode]
        );

        if (info) {
          setSequencingInfo(info);
          setMessage(`✅ Bale found! Row: ${info.row}, Lay: ${info.lay}, Sequence: ${info.sequence}`);
          setMessageType('success');
        } else {
          setSequencingInfo(null);
          setMessage(`❌ Bale with barcode "${lastBaleBarcode}" not found in sequencing records.`);
          setMessageType('error');
        }
      } catch (error) {
        console.error('Failed to load sequencing info:', error);
        setMessage('Error loading bale information.');
        setMessageType('error');
      }
    };

    const timeoutId = setTimeout(loadSequencingInfo, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [lastBaleBarcode]);

  const handlePrepareGap = async () => {
    Keyboard.dismiss();
    if (!lastBaleBarcode) {
      setMessage('Please scan or enter the Last Correct Bale Barcode first.');
      setMessageType('error');
      return;
    }

    if (!sequencingInfo) {
      setMessage('Bale information not found. Please check the barcode.');
      setMessageType('error');
      return;
    }

    const skipCount = parseInt(balesToSkipCount, 10);
    if (isNaN(skipCount) || skipCount <= 0) {
      setMessage('Number of bales missed must be greater than zero.');
      setMessageType('error');
      return;
    }

    try {
      // Create a placeholder record for the gap creation operation
      // The connector will detect this and route to the correct endpoint
      const operationId = uuidv4();
      const now = new Date().toISOString();

      // Use a special barcode pattern that the connector can detect
      // Format: RESEQUENCE_GAP_<last_bale_barcode>_<bales_to_skip_count>_<timestamp>
      const operationBarcode = `RESEQUENCE_GAP_${lastBaleBarcode}_${skipCount}_${Date.now()}`;

      await powersync.execute(
        `INSERT INTO receiving_curverid_bale_sequencing_model (
          id, barcode, row, lay, sequence, selling_point_id, floor_sale_id,
          create_date, write_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          operationBarcode,
          sequencingInfo.row,
          sequencingInfo.lay,
          sequencingInfo.sequence + 1, // Start sequence
          sequencingInfo.selling_point_id,
          sequencingInfo.floor_sale_id,
          now,
          now
        ]
      );

      // Store operation metadata in a way the connector can access
      // We'll use the barcode field to encode the operation type and parameters
      // The connector will parse this and route accordingly

      // Update local state
      setStartSequence(sequencingInfo.sequence + 1);
      setState('ready_to_scan');
      setScannedCount(0);
      setMessage(`✅ Gap of ${skipCount} sequence number(s) created successfully. You may now scan the ${skipCount} missed bale(s).`);
      setMessageType('success');
    } catch (error: any) {
      console.error('Failed to prepare gap:', error);
      setMessage(`Error preparing gap: ${error.message || 'Unknown error'}`);
      setMessageType('error');
    }
  };

  const handleScanMissedBale = async () => {
    Keyboard.dismiss();
    if (!baleBarcodeToScan) {
      setMessage('Please scan or enter the barcode of the missed bale.');
      setMessageType('error');
      return;
    }

    if (!sequencingInfo || startSequence === null) {
      setMessage('Please prepare the gap first.');
      setMessageType('error');
      return;
    }

    const skipCount = parseInt(balesToSkipCount, 10);
    if (scannedCount >= skipCount) {
      setMessage('All missed bales have been scanned.');
      setMessageType('info');
      return;
    }

    try {
      // Calculate the sequence number for this scan
      const sequenceToUse = startSequence + scannedCount;

      // Create a placeholder record for the missed bale scan
      // Use a special barcode pattern: RESEQUENCE_SCAN_<last_bale_barcode>_<missed_bale_barcode>_<scanned_count>
      const operationId = uuidv4();
      const now = new Date().toISOString();
      const operationBarcode = `RESEQUENCE_SCAN_${lastBaleBarcode}_${baleBarcodeToScan}_${scannedCount}_${Date.now()}`;

      await powersync.execute(
        `INSERT INTO receiving_curverid_bale_sequencing_model (
          id, barcode, row, lay, sequence, selling_point_id, floor_sale_id,
          create_date, write_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          operationBarcode,
          sequencingInfo.row,
          sequencingInfo.lay,
          sequenceToUse,
          sequencingInfo.selling_point_id,
          sequencingInfo.floor_sale_id,
          now,
          now
        ]
      );

      // Update local state
      const newScannedCount = scannedCount + 1;
      setScannedCount(newScannedCount);
      setBaleBarcodeToScan('');

      if (newScannedCount >= skipCount) {
        setState('done');
        setMessage(`✅ Successfully scanned ${newScannedCount} bale(s). Resequencing is complete!`);
        setMessageType('success');
      } else {
        const remaining = skipCount - newScannedCount;
        setMessage(`✅ Bale successfully scanned. Please scan the next ${remaining} bale(s).`);
        setMessageType('success');
      }
    } catch (error: any) {
      console.error('Failed to scan missed bale:', error);
      setMessage(`Error scanning bale: ${error.message || 'Unknown error'}`);
      setMessageType('error');
    }
  };

  const handleReset = () => {
    setState('input');
    setLastBaleBarcode('');
    setBalesToSkipCount('1');
    setBaleBarcodeToScan('');
    setMessage('');
    setScannedCount(0);
    setSequencingInfo(null);
    setStartSequence(null);
    setShowManualActions(false);
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    // 1) Hide scanner instantly
    setScannerVisible(false);
    
    // 2) Defer processing
    setTimeout(() => {
      if (scanningFor === 'last_bale') {
        setLastBaleBarcode(scannedBarcode);
        setShowManualActions(false);
      } else {
        setBaleBarcodeToScan(scannedBarcode);
        setShowManualActions(false);
        // Auto-process if in scanning state
        if (state === 'ready_to_scan') {
          handleScanMissedBale();
        }
      }
    }, 0);
  };

  const getMessageStyle = () => {
    switch (messageType) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Bale Resequencing', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 p-5"
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header card */}
          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">Bale Resequencing</Text>
            <Text className="text-base text-blue-900">
              Insert missed bales into the sequencing order.
            </Text>
          </View>

          {/* Stage 1: Input */}
          {state === 'input' && (
            <>
              <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="font-semibold text-gray-700 mb-2">Last Correct Bale Barcode</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-gray-50"
                    placeholder="Scan or enter barcode..."
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    value={lastBaleBarcode}
                    onChangeText={setLastBaleBarcode}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setScanningFor('last_bale');
                        setScannerVisible(true);
                        setShowManualActions(false);
                      }}
                      className="bg-[#65435C] p-3 rounded-lg justify-center items-center"
                      style={{ marginRight: 8 }}
                    >
                      <Camera size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setScannerVisible(false);
                        setShowManualActions(true);
                      }}
                      className="bg-gray-200 p-3 rounded-lg justify-center items-center"
                    >
                      <KeyboardIcon size={24} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Auto-populated info */}
              {sequencingInfo && (
                <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                  <Text className="font-semibold text-gray-700 mb-2">Bale Information</Text>
                  <View className="space-y-1">
                    <Text className="text-gray-800">Row: {sequencingInfo.row}</Text>
                    <Text className="text-gray-800">Lay: {sequencingInfo.lay}</Text>
                    <Text className="text-gray-800">Sequence: {sequencingInfo.sequence}</Text>
                    {sequencingInfo.selling_point_name && (
                      <Text className="text-gray-800">Selling Point: {sequencingInfo.selling_point_name}</Text>
                    )}
                    {sequencingInfo.floor_sale_name && (
                      <Text className="text-gray-800">Floor Sale: {sequencingInfo.floor_sale_name}</Text>
                    )}
                    {sequencingInfo.grower_number && (
                      <Text className="text-gray-800">Grower: {sequencingInfo.grower_number}</Text>
                    )}
                  </View>
                </View>
              )}

              <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="font-semibold text-gray-700 mb-2">Number of Bales Missed</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50"
                  placeholder="Enter number of bales missed..."
                  placeholderTextColor="#9CA3AF"
                  style={{ color: '#111827' }}
                  value={balesToSkipCount}
                  onChangeText={setBalesToSkipCount}
                  keyboardType="numeric"
                  onSubmitEditing={handlePrepareGap}
                />
              </View>

              {/* Prepare Gap Button - Always visible when conditions are met */}
              {sequencingInfo && parseInt(balesToSkipCount, 10) > 0 && (
                <TouchableOpacity
                  onPress={handlePrepareGap}
                  className="bg-[#65435C] p-4 rounded-lg items-center justify-center mb-4"
                >
                  <Text className="text-white font-bold text-lg">Prepare Gap</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Stage 2: Scanning */}
          {state === 'ready_to_scan' && (
            <>
              <View className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4">
                <Text className="font-semibold text-blue-900 mb-2">Scanning Missed Bales</Text>
                <Text className="text-blue-800">
                  Progress: {scannedCount} / {parseInt(balesToSkipCount, 10)} scanned
                </Text>
                {startSequence !== null && (
                  <Text className="text-blue-800">
                    Inserting at sequence: {startSequence + scannedCount}
                  </Text>
                )}
              </View>

              <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="font-semibold text-gray-700 mb-2">Missed Bale Barcode</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-gray-50"
                    placeholder="Scan or enter barcode..."
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    value={baleBarcodeToScan}
                    onChangeText={setBaleBarcodeToScan}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleScanMissedBale}
                  />
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setScanningFor('missed_bale');
                        setScannerVisible(true);
                        setShowManualActions(false);
                      }}
                      className="bg-[#65435C] p-3 rounded-lg justify-center items-center"
                      style={{ marginRight: 8 }}
                    >
                      <Camera size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setScannerVisible(false);
                        setShowManualActions(true);
                      }}
                      className="bg-gray-200 p-3 rounded-lg justify-center items-center"
                    >
                      <KeyboardIcon size={24} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {showManualActions && (
                <TouchableOpacity
                  onPress={handleScanMissedBale}
                  className="bg-[#65435C] p-4 rounded-lg items-center justify-center mb-4"
                >
                  <Text className="text-white font-bold text-lg">Scan Missed Bale</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Stage 3: Done */}
          {state === 'done' && (
            <View className="bg-green-50 rounded-lg border border-green-200 p-4 mb-4">
              <Text className="font-semibold text-green-900 mb-2">✅ Resequencing Complete</Text>
              <Text className="text-green-800">
                Successfully scanned {scannedCount} missed bale(s).
              </Text>
            </View>
          )}

          {/* Message card */}
          {message && (
            <View className={`p-4 rounded-lg border mb-4 ${getMessageStyle()}`}>
              <Text className="text-base">{message}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View className="flex-row gap-3">
            {state !== 'input' && (
              <TouchableOpacity
                onPress={handleReset}
                className="flex-1 bg-gray-200 p-4 rounded-lg items-center justify-center"
              >
                <Text className="text-gray-800 font-semibold">Reset</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-semibold text-lg">Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={isScannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title={scanningFor === 'last_bale' ? 'Scan Last Correct Bale' : 'Scan Missed Bale'}
          stayOnCamera={true}
        />
      </Modal>
    </>
  );
};

export default BaleResequencingScreen;

