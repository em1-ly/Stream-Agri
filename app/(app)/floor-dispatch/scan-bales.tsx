import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';

const ScanBalesScreen = () => {
  const router = useRouter();
  const { dispatchNoteId } = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleCount, setBaleCount] = useState(0);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [dispatchNote, setDispatchNote] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [isManualInputVisible, setManualInputVisible] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');

  useEffect(() => {
    const fetchDispatchNote = async () => {
      if (dispatchNoteId) {
        try {
          const note = await powersync.get<any>(
            `SELECT dn.*, wh.name as warehouse_destination_name 
             FROM floor_dispatch_note dn
             LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
             WHERE dn.id = ? OR dn.mobile_app_id = ?`, 
            [dispatchNoteId, dispatchNoteId]
          );
          setDispatchNote(note);
          const countResult = await powersync.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM floor_dispatch_bale db
             LEFT JOIN floor_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
             WHERE dn.id = ? OR dn.mobile_app_id = ?`, 
            [dispatchNoteId, dispatchNoteId]
          );
          setBaleCount(countResult?.count || 0);
        } catch (error) {
          console.error('Failed to fetch dispatch note:', error);
          Alert.alert('Error', 'Could not load dispatch note details.');
        }
      }
    };
    fetchDispatchNote();
    
    // Auto-open scanner
    setTimeout(() => {
      setScannerVisible(true);
    }, 300);
  }, [dispatchNoteId]);

  const handleSaveBale = async (scannedCode?: string) => {
    Keyboard.dismiss();
    if (isProcessingLocal) return; // Prevent concurrent scans

    const codeToProcess = (scannedCode || barcode);
    if (!codeToProcess) {
      setMessage('Please enter a barcode.');
      setScanStatus('error');
      return;
    }

    setIsProcessingLocal(true); // Lock
    setMessage('');
    setScanStatus('processing');
    setLastScannedBarcode(codeToProcess);

    try {
      // Fetch bale with all necessary fields for validation
      const bale = await powersync.getOptional<any>(
        "SELECT id, state, buyer, salesmaster_id, is_released FROM receiving_bale WHERE barcode = ?",
        [codeToProcess]
      );

      if (!bale) {
        setMessage(`Bale with barcode ${codeToProcess} not found in the system.`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      // 0. Pre-validation: Check if bale is already marked as dispatched in its own state
      if (bale.state === 'dispatched') {
        setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) is already marked as dispatched in the system.`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      if (!bale.is_released) {
        setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) cannot be dispatched because it has not been released.`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      // 1. Bulletproof check: Is this bale ALREADY in the current dispatch note?
      // Check directly in floor_dispatch_bale without complex joins first
      const alreadyInNote = await powersync.getOptional<any>(
        `SELECT id FROM floor_dispatch_bale 
         WHERE receiving_bale_id = ? AND (dispatch_note_id = ? OR dispatch_note_id = ?)`,
        [bale.id, dispatchNoteId, dispatchNote?.id || dispatchNoteId]
      );

      if (alreadyInNote) {
        setMessage(`Bale ${codeToProcess} is already in this dispatch note!`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      // 2. Check if bale is in ANOTHER dispatch note
      const existingLines = await powersync.getAll<any>(
        `SELECT db.dispatch_note_id, dn.state, dn.reference
         FROM floor_dispatch_bale db
         LEFT JOIN floor_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
         WHERE db.receiving_bale_id = ?`, 
        [bale.id]
      );

      const inOtherDispatch = existingLines.find(line => {
        // We already checked the current note, so any other line is another note
        // unless it's a cancelled note
        return line.state !== 'cancel';
      });

      if (inOtherDispatch) {
        setMessage(`Bale ${codeToProcess} is already dispatched in note ${inOtherDispatch.reference || 'another dispatch'} (State: ${inOtherDispatch.state || 'unknown'})!`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      // 2. Check if the bale's sale has been posted (pre-validation to avoid sending wrong data)
      if (bale.salesmaster_id) {
        const salesMaster = await powersync.getOptional<any>(
          'SELECT state FROM data_processing_salesmaster WHERE id = ?',
          [String(bale.salesmaster_id)]
        );
        if (!salesMaster) {
          setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) is missing its Sales Info (Sales ID: ${bale.salesmaster_id}). Please sync and try again.`);
          setScanStatus('error');
          setIsProcessingLocal(false);
          return;
        }
        if (salesMaster.state !== 'posted' && salesMaster.state !== 'processed') {
          // Match Odoo message (including wording)
          setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) cannot be dispatched: its sale (ID: ${bale.salesmaster_id}) state is '${salesMaster.state}', but it must be 'posted' or 'processed'!`);
          setScanStatus('error');
          setIsProcessingLocal(false);
          return;
        }
      } else {
        setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) cannot be dispatched: sale information (salesmaster_id) is missing!`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      // 3. Check if the bale is being dispatched to the correct warehouse
      // Match Odoo wizard: compare buyer.packing_warehouse_id with dispatch note destination packing_warehouse_id
      if (bale.buyer && dispatchNote?.warehouse_destination_id) {
        const destinationWarehouse = await powersync.getOptional<any>(
          'SELECT name, packing_warehouse_id FROM warehouse_warehouse WHERE id = ?',
          [String(dispatchNote.warehouse_destination_id)]
        );
        if (!destinationWarehouse) {
          setMessage(`Destination warehouse info (ID: ${dispatchNote.warehouse_destination_id}) is missing from the system. Please sync and try again.`);
          setScanStatus('error');
          setIsProcessingLocal(false);
          return;
        }

        const baleBuyer = await powersync.getOptional<any>(
          'SELECT packing_warehouse_id FROM buyers_buyer WHERE id = ?',
          [String(bale.buyer)]
        );
        if (!baleBuyer) {
          setMessage(`Bale '${codeToProcess}' (ID: ${bale.id}) is missing its Buyer Info (Buyer ID: ${bale.buyer}). Please sync and try again.`);
          setScanStatus('error');
          setIsProcessingLocal(false);
          return;
        }

        if (String(destinationWarehouse.packing_warehouse_id) !== String(baleBuyer.packing_warehouse_id)) {
          // Align message with Odoo: "cannot be dispatched: you are trying to dispatch into the wrong warehouse '<dest name>'."
          setMessage(
            `Bale '${codeToProcess}' (ID: ${bale.id}) cannot be dispatched: you are trying to dispatch into the wrong warehouse '${destinationWarehouse.name || ''}'.`
          );
          setScanStatus('error');
          setIsProcessingLocal(false);
          return;
        }
      } else {
        const missing = [];
        if (!bale.buyer) missing.push(`Buyer on Bale (ID: ${bale.id})`);
        if (!dispatchNote?.warehouse_destination_id) missing.push('Warehouse Destination on Dispatch Note');
        
        setMessage(`Bale '${codeToProcess}' cannot be dispatched: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing.`);
        setScanStatus('error');
        setIsProcessingLocal(false);
        return;
      }

      const newLineId = uuidv4();
      const now = new Date().toISOString();
      await powersync.execute(
        'INSERT INTO floor_dispatch_bale (id, dispatch_note_id, receiving_bale_id, create_date, write_date) VALUES (?, ?, ?, ?, ?)',
        [newLineId, dispatchNoteId, bale.id, now, now]
      );

      // Also update the original bale to mark it as dispatched
      // Note: dispatched_by_id will be set by the server during sync
      await powersync.execute(
        'UPDATE receiving_bale SET dispatch_date_time = ?, state = ? WHERE id = ?',
        [now, 'dispatched', bale.id]
      );

      setMessage(`Bale ${codeToProcess} added successfully.`);
      setScanStatus('success');
      setBaleCount(prev => prev + 1);
      setBarcode(''); // Clear input for next scan
      
      // Reset status after showing success message
      setTimeout(() => {
        setScanStatus('idle');
        setMessage('');
        setLastScannedBarcode('');
      }, 2000);

    } catch (error) {
      console.error('Failed to save bale:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setMessage(`Error saving bale: ${errorMessage}`);
      setScanStatus('error');
    } finally {
      setIsProcessingLocal(false); // Unlock
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    // Keep scanner open and process the barcode
    // Scanner will stay open for continuous scanning
    handleSaveBale(scannedBarcode);
  };

  const handleDone = async () => {
    const navigateToNext = async () => {
    try {
      // Always refresh the local record to ensure we have latest mobile_app_id
      let note = null;
      if (dispatchNoteId) {
        note = await powersync.getOptional<any>(
          'SELECT id, mobile_app_id FROM floor_dispatch_note WHERE id = ? OR mobile_app_id = ?',
          [dispatchNoteId, dispatchNoteId]
        );
      }
      const targetId = note?.mobile_app_id || note?.id || dispatchNote?.mobile_app_id || dispatchNoteId;
      console.log('🧭 handleDone navigation target', {
        dispatchNoteId,
        localLookup: note,
        mobileAppId: note?.mobile_app_id || dispatchNote?.mobile_app_id,
        targetId,
      });
      if (targetId) {
        router.replace({ pathname: '/(app)/floor-dispatch/dispatch-note-detail', params: { id: targetId } });
      } else {
        router.replace('/(app)/floor-dispatch/dispatch-note');
      }
    } catch (error) {
      console.error('🔁 handleDone fallback due to error', error);
      router.replace('/(app)/floor-dispatch/dispatch-note');
    }
    };

    Alert.alert(
      'Dispatch Summary',
      `You have scanned ${baleCount} bale${baleCount !== 1 ? 's' : ''} for dispatch note ${dispatchNote?.reference || 'this note'}.`,
      [
        {
          text: 'OK',
          onPress: navigateToNext,
        }
      ],
      { cancelable: false }
    );
  };

  return (
    <View className="flex-1 bg-white p-5">
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
            progress: { scanned: baleCount, total: 0 }
          }}
        />
      </Modal>

      {/* Header Section - Matching Odoo Wizard View */}
      <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
        <Text className="text-lg font-bold text-blue-900 mb-2">
          {dispatchNote?.reference && dispatchNote?.warehouse_destination_name 
            ? `${dispatchNote.reference} to ${dispatchNote.warehouse_destination_name}`
            : dispatchNote?.reference || dispatchNote?.name || 'Dispatch Note'}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-blue-800 mr-2">Scanned:</Text>
          <Text className="text-lg font-bold text-blue-900">{baleCount}</Text>
          <Text className="text-base font-semibold text-blue-800 ml-1">bales</Text>
        </View>
      </View>

      {/* Barcode Input Section */}
      <View className="flex-row items-center mb-4 gap-2">
          <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholder="Enter barcode manually..."
              value={barcode}
              onChangeText={setBarcode}
              onSubmitEditing={() => handleSaveBale()}
              autoFocus={true}
          />
          <TouchableOpacity
              onPress={() => setScannerVisible(true)}
            className="p-3 bg-gray-200 rounded-lg"
          >
              <Camera size={24} color="#333" />
          </TouchableOpacity>
        <TouchableOpacity
            onPress={() => setManualInputVisible(!isManualInputVisible)}
            className={`p-3 rounded-lg ${isManualInputVisible ? 'bg-blue-600' : 'bg-gray-200'}`}
        >
            <KeyboardIcon size={24} color={isManualInputVisible ? "#fff" : "#333"} />
        </TouchableOpacity>
      </View>

      {/* Message Section */}
      {message ? (
        <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: message.includes('successfully') ? '#d1fae5' : message.includes('Error') || message.includes('cannot') ? '#fee2e2' : '#fef3c7' }}>
          <Text className={`text-center text-base font-semibold ${message.includes('successfully') ? 'text-green-800' : message.includes('Error') || message.includes('cannot') ? 'text-red-800' : 'text-yellow-800'}`}>
            {message}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {isManualInputVisible && (
        <TouchableOpacity
          onPress={() => handleSaveBale()}
          className="flex-1 bg-blue-600 p-4 rounded-lg items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">Save Bale</Text>
        </TouchableOpacity>
        )}
        
        <TouchableOpacity
          onPress={handleDone}
          className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ScanBalesScreen;
