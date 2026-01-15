import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Camera } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Picker } from '@react-native-picker/picker';
import { useSession } from '@/authContext';

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

const ScanBalesScreen = () => {
  const router = useRouter();
  const { session } = useSession();
  const { dispatchNoteId } = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleCount, setBaleCount] = useState(0);
  const [dispatchNote, setDispatchNote] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fetchDispatchNote = async () => {
      if (dispatchNoteId) {
        try {
          const note = await powersync.get<any>(
            `SELECT dn.*, 
                    wh_dest.name as warehouse_destination_name,
                    wh_source.name as warehouse_source_name
             FROM warehouse_dispatch_note dn
             LEFT JOIN warehouse_warehouse wh_dest ON dn.warehouse_destination_id = wh_dest.id
             LEFT JOIN warehouse_warehouse wh_source ON dn.warehouse_source_id = wh_source.id
             WHERE dn.id = ? OR dn.mobile_app_id = ?`, 
            [dispatchNoteId, dispatchNoteId]
          );
          setDispatchNote(note);
          
          const countResult = await powersync.getOptional<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM warehouse_dispatch_bale db
             WHERE (db.dispatch_note_id = ? OR db.dispatch_note_id = ?)`, 
            [note?.id || dispatchNoteId, note?.mobile_app_id || dispatchNoteId]
          );
          setBaleCount(countResult?.count || 0);
        } catch (error) {
          console.error('Failed to fetch dispatch note:', error);
          Alert.alert('Error', 'Could not load dispatch note details.');
        }
      }
    };
    fetchDispatchNote();
  }, [dispatchNoteId]);

  const handleSaveBale = async (scannedCode?: string) => {
    const codeToProcess = (scannedCode || barcode).trim();
    if (!codeToProcess) {
      setMessage('Please enter a barcode.');
      setIsSaving(false);
      return;
    }
    
    setBarcode('');
    setMessage('');
    setScanStatus('processing');
    setIsSaving(true);

    try {
      if (!dispatchNote) {
        setMessage('Dispatch note not loaded. Please go back and try again.');
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      const shipped_bale = await powersync.getOptional<any>(
        `SELECT sb.id, sb.barcode, sb.warehouse_id, sb.stock_status, sb.received, sb.product_id, sb.grade, sb.mass, sb.received_mass, wh.name as warehouse_name
         FROM warehouse_shipped_bale sb
         LEFT JOIN warehouse_warehouse wh ON sb.warehouse_id = wh.id
         WHERE sb.barcode = ? OR sb.logistics_barcode = ?
         LIMIT 1`,
        [codeToProcess, codeToProcess]
      );

      if (!shipped_bale) {
        setMessage(`Product '${codeToProcess}' not found!`);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      if (dispatchNote.warehouse_destination_id && 
          String(shipped_bale.warehouse_id) === String(dispatchNote.warehouse_destination_id)) {
        const msg = `Product '${codeToProcess}' is already in the destination warehouse!`;
        setMessage(msg);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      if (dispatchNote.warehouse_source_id && 
          String(shipped_bale.warehouse_id) !== String(dispatchNote.warehouse_source_id)) {
        setMessage(`Product '${codeToProcess}' is not in the source warehouse!`);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      if (dispatchNote.product_id && shipped_bale.product_id && 
          String(shipped_bale.product_id) !== String(dispatchNote.product_id)) {
        const [baleProduct, noteProduct] = await Promise.all([
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shipped_bale.product_id)]),
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(dispatchNote.product_id)])
        ]);
        setMessage(`Product Mismatch! Bale is '${baleProduct?.name || shipped_bale.product_id}', but dispatch is for '${noteProduct?.name || dispatchNote.product_id}'.`);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      const actualDispatchNoteId = dispatchNote.id || dispatchNoteId;
      
      const performSaveInternal = async () => {
        try {
          const now = new Date().toISOString();
          const newLineId = uuidv4();

          const existingInCurrent = await powersync.getOptional<any>(
            `SELECT id FROM warehouse_dispatch_bale 
             WHERE shipped_bale_id = ? 
               AND (dispatch_note_id = ? OR dispatch_note_id = ? OR dispatch_note_id = ?)
             LIMIT 1`,
            [shipped_bale.id, actualDispatchNoteId, dispatchNote.id, dispatchNote.mobile_app_id]
          );

          if (existingInCurrent) {
            setMessage(`Product '${codeToProcess}' is already in this dispatch note!`);
            setScanStatus('error');
            setIsSaving(false);
            return;
          }

          await powersync.execute(
            'INSERT INTO warehouse_dispatch_bale (id, dispatch_note_id, shipped_bale_id, barcode, origin_document, create_date, write_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newLineId, actualDispatchNoteId, shipped_bale.id, codeToProcess, 'process_run_dispatch', now, now]
          );

          setMessage(`Product '${codeToProcess}' dispatched successfully!`);
          setBaleCount(prev => prev + 1);
          setScanStatus('success');
          setIsSaving(false);
          
          setTimeout(() => {
            setScanStatus('idle');
            setMessage('');
          }, 2000);
        } catch (e: any) {
          console.error('Failed to perform save:', e);
          setMessage(`Error saving bale: ${e.message}`);
          setScanStatus('error');
          setIsSaving(false);
        }
      };

      if (dispatchNote.instruction_id) {
        const instructionLine = await powersync.getOptional<any>(
          `SELECT * FROM warehouse_instruction_line 
           WHERE instruction_id = ? AND product_id = ? AND grade_id = ?`,
          [Number(dispatchNote.instruction_id), Number(shipped_bale.product_id), Number(shipped_bale.grade)]
        );

        if (!instructionLine) {
          const [product, grade, instruction] = await Promise.all([
            powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shipped_bale.product_id)]),
            powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(shipped_bale.grade)]),
            powersync.getOptional<any>('SELECT name FROM warehouse_instruction WHERE id = ?', [String(dispatchNote.instruction_id)])
          ]);
          
          const productName = product?.name || `ID:${shipped_bale.product_id}`;
          const gradeName = grade?.name || `ID:${shipped_bale.grade}`;
          const instructionName = instruction?.name || `ID:${dispatchNote.instruction_id}`;
          
          setMessage(`Validation Error! Product '${productName}' with grade '${gradeName}' is not allowed under shipping instruction '${instructionName}'!`);
          setScanStatus('error');
          setIsSaving(false);
          return;
        }

        const baleMass = shipped_bale.received_mass || shipped_bale.mass || 0;
        const remainingMass = instructionLine.remaining_mass || 0;
        if (remainingMass < baleMass) {
          const [product, grade] = await Promise.all([
            powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shipped_bale.product_id)]),
            powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(shipped_bale.grade)])
          ]);
          const msg = `WARNING: Mass exceeds shipping instruction limit!\n\n` +
                      `Product: ${product?.name || shipped_bale.product_id} (Barcode: ${codeToProcess})\n` +
                      `Grade: ${grade?.name || shipped_bale.grade}\n` +
                      `Required: ${remainingMass.toFixed(2)} kg\n` +
                      `Dispatched: ${baleMass.toFixed(2)} kg\n\n` +
                      `Proceed anyway?`;
          
          Alert.alert('Dispatch Warning', msg, [
            { text: 'Cancel', style: 'cancel', onPress: () => { setMessage('Bale addition cancelled.'); setScanStatus('idle'); setIsSaving(false); } },
            { text: 'Proceed Anyway', style: 'destructive', onPress: () => performSaveInternal() }
          ]);
          return;
        }
      }

      const normalizeId = (id: any): string | null => {
        if (id === null || id === undefined) return null;
        return String(id);
      };

      const noteIdsToMatch = [
        dispatchNote.id,
        dispatchNote.mobile_app_id,
        actualDispatchNoteId,
      ]
        .map(normalizeId)
        .filter((id): id is string => id !== null);

      const existingInCurrent = await powersync.getOptional<any>(
        `SELECT db.id FROM warehouse_dispatch_bale db
         WHERE db.shipped_bale_id = ? 
           AND (db.dispatch_note_id = ? OR db.dispatch_note_id = ? OR db.dispatch_note_id = ?)
         LIMIT 1`,
        [shipped_bale.id, actualDispatchNoteId, dispatchNote.id, dispatchNote.mobile_app_id]
      );

      if (existingInCurrent) {
        setMessage(`Product '${codeToProcess}' is already in this dispatch note!`);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      const allDraftDispatchLines = await powersync.getAll<any>(
        `SELECT db.dispatch_note_id FROM warehouse_dispatch_bale db
         WHERE db.shipped_bale_id = ? AND db.state = 'draft'`,
        [shipped_bale.id]
      );

      const existingInOtherDraft = allDraftDispatchLines.find((line) => {
        const lineNoteId = normalizeId(line.dispatch_note_id);
        return lineNoteId && !noteIdsToMatch.includes(lineNoteId);
      });

      if (existingInOtherDraft) {
        setMessage(`Product '${codeToProcess}' is already dispatched in another draft note!`);
        setScanStatus('error');
        setIsSaving(false);
        return;
      }

      if (dispatchNote.warehouse_source_id) {
        const sourceWarehouse = await powersync.getOptional<any>(
          'SELECT warehouse_type FROM warehouse_warehouse WHERE id = ?',
          [String(dispatchNote.warehouse_source_id)]
        );

        if (sourceWarehouse?.warehouse_type === 'internal') {
          const stockStatus = shipped_bale.stock_status;
          const received = shipped_bale.received;
          
          if ((stockStatus === 'in_transit' || stockStatus === 'out_stock') || !received) {
            setMessage(`Product '${codeToProcess}' is not eligible for dispatch (not received or in wrong stock state)!`);
            setScanStatus('error');
            setIsSaving(false);
            return;
          }
        }
      }

      await performSaveInternal();
    } catch (error) {
      console.error('Failed to save bale:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setMessage(`Error saving bale: ${errorMessage}`);
      setScanStatus('error');
      setIsSaving(false);
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    handleSaveBale(scannedBarcode);
  };

  const handleDone = async () => {
    try {
      const summaryMessage = 
        `✅ Process Run Scan Complete!\n\n` +
        `📦 Bales Scanned: ${baleCount}\n` +
        (dispatchNote?.reference ? `📋 Dispatch Note: ${dispatchNote.reference}\n` : '') +
        (dispatchNote?.warehouse_source_name ? `🏢 From: ${dispatchNote.warehouse_source_name}\n` : '') +
        (dispatchNote?.warehouse_destination_name ? `📍 To: ${dispatchNote.warehouse_destination_name}` : '');

      Alert.alert(
        'Process Run Scan Complete',
        summaryMessage,
        [
          {
            text: 'OK',
            onPress: async () => {
      let note = null;
      if (dispatchNoteId) {
        note = await powersync.getOptional<any>(
          'SELECT id, mobile_app_id FROM warehouse_dispatch_note WHERE id = ? OR mobile_app_id = ?',
          [dispatchNoteId, dispatchNoteId]
        );
      }
      const targetId = note?.mobile_app_id || note?.id || dispatchNote?.mobile_app_id || dispatchNoteId;
      if (targetId) {
        router.replace({
          pathname: '/(app)/inventory/dispatch/warehouse-dispatch-note-details',
          params: { id: String(targetId) },
        });
      } else {
        router.replace('/(app)/inventory/dispatch/warehouse-dispatch-note');
      }
            },
          },
        ]
      );
    } catch (error) {
      console.error('🔁 handleDone fallback due to error', error);
      router.replace('/(app)/inventory/dispatch/warehouse-dispatch-note');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Process Run Scan', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          className="flex-1 p-5" 
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

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

          <View className="mb-4">
            <View className="flex-row items-center mb-3">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Scan or enter barcode here..."
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={() => handleSaveBale()}
                autoFocus={true}
              />
              <TouchableOpacity
                onPress={() => setScannerVisible(true)}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {message ? (
            <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: message.includes('successfully') ? '#d1fae5' : message.includes('Error') || message.includes('cannot') || message.includes('Mismatch') || message.includes('allowed') ? '#fee2e2' : '#fef3c7' }}>
              <Text className={`text-center text-base font-bold ${message.includes('successfully') ? 'text-green-800' : message.includes('Error') || message.includes('cannot') || message.includes('Mismatch') || message.includes('allowed') ? 'text-red-800' : 'text-yellow-800'}`}>
                {message}
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
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
          onClose={() => {
            setScannerVisible(false);
            setScanStatus('idle');
            setMessage('');
          }}
          scanType="bale"
          title="Scan Bale Barcode"
          subtitle={message || undefined}
          scanStatus={scanStatus}
          stayOnCamera={true}
          displayInfo={{
            gdnNumber: dispatchNote?.reference || undefined,
            progress: { scanned: baleCount, total: 0 }
          }}
        />
      </Modal>
    </>
  );
};

export default ScanBalesScreen;
