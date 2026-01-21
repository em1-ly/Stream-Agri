import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Camera } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useSession } from '@/authContext';

const ScanBalesScreen = () => {
  const router = useRouter();
  const { session } = useSession();
  const { dispatchNoteId } = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [logistics_barcode, setLogisticsBarcode] = useState('');
  const [weight, setWeight] = useState('');
  const [bale_count, setBaleCount] = useState(0);
  const [dispatchNote, setDispatchNote] = useState<any>(null);
  const [sourceWhType, setSourceWhType] = useState<string | null>(null);
  const [destWhType, setDestWhType] = useState<string | null>(null);
  const [weightVisible, setWeightVisible] = useState(true);
  const [message, setMessage] = useState('');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanningMode, setScanningMode] = useState<'bale_barcode' | 'logistics_barcode'>('bale_barcode'); // New state for scanning mode
  const [isSaving, setIsSaving] = useState(false);
  const [mass_override_confirmed, setMassOverrideConfirmed] = useState(false); // Track if user confirmed mass override for this session
  const massInputRef = useRef<TextInput>(null);
  const barcodeLookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let countWatcherAbort: AbortController | null = null;

    const setupCountWatcher = async () => {
      if (dispatchNoteId) {
        countWatcherAbort = new AbortController();
        
        // Use a more robust query that doesn't strictly depend on the JOIN and allows NULL states
        powersync.watch(
          `SELECT COUNT(*) as count 
           FROM warehouse_dispatch_bale db
           LEFT JOIN warehouse_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
           WHERE (
             CAST(dn.id AS TEXT) = ? 
             OR dn.mobile_app_id = ? 
             OR CAST(db.dispatch_note_id AS TEXT) = ? 
             OR db.dispatch_note_id = ?
           ) 
           AND (db.state = 'draft' OR db.state IS NULL)`,
          [String(dispatchNoteId), String(dispatchNoteId), String(dispatchNoteId), String(dispatchNoteId)],
          {
            onResult: (result) => {
              const count = result.rows?._array?.[0]?.count || 0;
              console.log('🔍 Bale count updated (scan screen):', { count, dispatchNoteId });
              setBaleCount(count);
            },
            onError: (err) => console.error('Failed to watch bale count:', err)
          },
          { signal: countWatcherAbort.signal }
        );
      }
    };

    setupCountWatcher();
    return () => countWatcherAbort?.abort();
  }, [dispatchNoteId]);

  useEffect(() => {
    const fetchDispatchNote = async () => {
      if (dispatchNoteId) {
        try {
          // Always refresh the local record to ensure we have latest mobile_app_id
          const note = await powersync.get<any>(
            `SELECT dn.*, 
                    wh_dest.name as warehouse_destination_name,
                    wh_dest.warehouse_type as dest_wh_type,
                    wh_src.name as source_wh_name,
                    wh_src.warehouse_type as source_wh_type,
                    p.technical_name as product_technical_name
             FROM warehouse_dispatch_note dn
             LEFT JOIN warehouse_warehouse wh_dest ON dn.warehouse_destination_id = wh_dest.id
             LEFT JOIN warehouse_warehouse wh_src ON dn.warehouse_source_id = wh_src.id
             LEFT JOIN warehouse_product p ON dn.product_id = p.id
             WHERE dn.id = ? OR dn.mobile_app_id = ?`, 
            [dispatchNoteId, dispatchNoteId]
          );
          setDispatchNote(note);
          setSourceWhType(note.source_wh_type);
          setDestWhType(note.dest_wh_type);

          // Weight visibility logic: matches Odoo wizard logic
          const sourceType = note.source_wh_type;
          const destType = note.dest_wh_type;
          const isPackedProduct = note.product_technical_name === 'packed_product';
          const isWeightVisible = !(
            (sourceType === 'internal' && destType === 'internal') ||
            sourceType === 'satellite' ||
            (sourceType === 'internal' && destType === 'external' && isPackedProduct)
          );
          setWeightVisible(isWeightVisible);
          
          // Reset mass override confirmation when dispatch note changes (like Odoo's default_get)
          setMassOverrideConfirmed(false);
        } catch (error) {
          console.error('Failed to fetch dispatch note:', error);
          Alert.alert('Error', 'Could not load dispatch note details.');
        }
      }
    };
    fetchDispatchNote();
  }, [dispatchNoteId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeLookupTimeoutRef.current) {
        clearTimeout(barcodeLookupTimeoutRef.current);
      }
    };
  }, []);

  const _validateAgainstShippingInstruction = async (shippedBale: any, code: string, baleMass: number, actualDispatchNoteId: string, now: string) => {
    const instructionLine = await powersync.getOptional<any>(
      `SELECT * FROM warehouse_instruction_line 
       WHERE instruction_id = ? AND product_id = ? AND grade_id = ?`,
      [Number(dispatchNote.instruction_id), Number(shippedBale.product_id), Number(shippedBale.grade)]
    );

    if (!instructionLine) {
      const [product, grade, instruction] = await Promise.all([
        powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shippedBale.product_id)]),
        powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(shippedBale.grade)]),
        powersync.getOptional<any>('SELECT name FROM warehouse_instruction WHERE id = ?', [String(dispatchNote.instruction_id)])
      ]);
      
      const productName = product?.name || `ID:${shippedBale.product_id}`;
      const gradeName = grade?.name || `ID:${shippedBale.grade}`;
      const instructionName = instruction?.name || `ID:${dispatchNote.instruction_id}`;
      
      const msg = `Validation Error!\n\n` +
                  `Product '${productName}' (Barcode: ${code}) with grade '${gradeName}' is not allowed under shipping instruction '${instructionName}'!`;
      setMessage(msg);
      setIsSaving(false);
      return false;
    }

    const remainingMass = instructionLine.remaining_mass || 0;
    if (remainingMass < baleMass) {
      if (mass_override_confirmed) return true;
      
      const [product, grade] = await Promise.all([
        powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shippedBale.product_id)]),
        powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(shippedBale.grade)])
      ]);
      const excess = baleMass - remainingMass;
      const msg = `WARNING: Mass exceeds shipping instruction limit!\n\n` +
                  `Product: ${product?.name || shippedBale.product_id} (Barcode: ${code})\n` +
                  `Grade: ${grade?.name || shippedBale.grade}\n` +
                  `Required: ${remainingMass.toFixed(2)} kg\n` +
                  `Dispatched: ${baleMass.toFixed(2)} kg\n` +
                  `Excess: ${excess.toFixed(2)} kg\n\n` +
                  `Click 'Confirm Override' to proceed anyway.`;

      Alert.alert('Dispatch Warning', msg, [
        { text: 'Cancel', style: 'cancel', onPress: () => {
          setMessage('Bale addition cancelled.');
          setIsSaving(false);
        }},
        { text: 'Confirm Override', style: 'destructive', onPress: () => {
          setMassOverrideConfirmed(true);
          _createDispatchBale(uuidv4(), actualDispatchNoteId, shippedBale.id, code, logistics_barcode, baleMass, now);
        }}
      ]);
      return false;
    }
    return true;
  };

  const _validateShippedBaleForDispatch = async (shippedBale: any, code: string, noteIdsToMatch: string[], actualDispatchNoteId: string) => {
    // 1) Find ANY existing records for this bale ID in the local database
    const localLines = await powersync.getAll<any>(
      `SELECT db.id, db.dispatch_note_id, db.state, dn.reference as dispatch_note_reference, dn.state as dispatch_note_state
       FROM warehouse_dispatch_bale db
       LEFT JOIN warehouse_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
       WHERE db.shipped_bale_id = ? OR db.barcode = ? OR db.logistics_barcode = ?`,
      [shippedBale.id, code, code]
    );

    console.log('🔍 Local validation check - existing records found:', localLines.length);
    if (localLines.length > 0) {
      console.log('🔍 Local validation check - existing records details:', JSON.stringify(localLines));
      // Debug: log each record's state
      localLines.forEach((l, idx) => {
        console.log(`🔍 Record ${idx}: dispatch_note_id=${l.dispatch_note_id}, line_state=${l.state}, dispatch_note_state=${l.dispatch_note_state}, reference=${l.dispatch_note_reference}`);
      });
    }

    // 2) Check for existing record in another draft dispatch note (only block if in draft, not posted)
    // IMPORTANT: Only block if we can confirm the dispatch note is draft. If state is NULL/empty, allow (might be posted but not synced)
    const existingRecord = localLines.find(l => {
      const lineNoteId = String(l.dispatch_note_id);
      const isCurrent = noteIdsToMatch.includes(lineNoteId);
      
      // Skip if already in current note or line is cancelled
      if (isCurrent || l.state === 'cancel') {
        return false;
      }
      
      // Only block if we have a confirmed draft state
      const dispatchNoteState = (l.dispatch_note_state || '').trim().toLowerCase();
      const shouldBlock = dispatchNoteState === 'draft';
      
      console.log(`🔍 Validation check for line ${l.id}: isCurrent=${isCurrent}, lineState=${l.state}, dispatchNoteState="${dispatchNoteState}", shouldBlock=${shouldBlock}`);
      return shouldBlock;
    });
    
    if (existingRecord) {
      const lineNoteId = String(existingRecord.dispatch_note_id);
      
      const msg = `Product '${code}' is already dispatched in DRAFT note ${existingRecord.dispatch_note_reference || existingRecord.dispatch_note_id}! (v1.0.3)`;
        
      console.log('🚨 Scan bale validation error: existing record found in draft dispatch note', { code, noteId: lineNoteId, dispatchNoteState: existingRecord.dispatch_note_state, version: '1.0.3' });
      setMessage(msg);
      setIsSaving(false);
      return false;
    }

    // 3) Check if bale is already in current dispatch note
    const existingInCurrent = localLines.find(l => {
      const lineNoteId = String(l.dispatch_note_id);
      return noteIdsToMatch.includes(lineNoteId);
    });
    
    if (existingInCurrent) {
      const msg = `Product '${code}' is already in this dispatch note!`;
      console.log('🚨 Scan bale validation error: already in current dispatch note', { code });
      setMessage(msg);
      setIsSaving(false);
      return false;
    }

    // 4) Check pending uploads (ps_crud)
    if (shippedBale.id) {
      try {
        const baleId = String(shippedBale.id);
        // Use a more robust check for pending uploads
        const allPending = await powersync.getAll<any>(
          `SELECT id, data FROM ps_crud WHERE data LIKE ? OR data LIKE ?`,
          [`%${baleId}%`, `%${code}%`]
        );
        
        const duplicateInPending = allPending.find(op => {
          try {
            const parsed = JSON.parse(op.data);
            const opData = parsed.data || {};
            // The table might be in 'table' or inside 'data.table' depending on PowerSync version/config
            const tableName = parsed.table || opData.table;
            
            if (tableName !== 'warehouse_dispatch_bale') return false;
            if (parsed.op !== 'PUT' && parsed.op !== 'PATCH') return false;

            const opShippedBaleId = String(opData.shipped_bale_id || '');
            const opBarcode = String(opData.barcode || '');
            
            if (opShippedBaleId !== baleId && opBarcode !== code) return false;
            
            // If it's in pending and not being cancelled, it's a duplicate
            return (opData.state || 'draft') !== 'cancel';
          } catch (e) {
            return false;
          }
        });
        
        if (duplicateInPending) {
          const parsed = JSON.parse(duplicateInPending.data);
          const opNoteId = String(parsed.data?.dispatch_note_id || '');
          const isCurrentNote = noteIdsToMatch.includes(opNoteId);
          
          const msg = isCurrentNote 
            ? `Product '${code}' is already being saved for this dispatch note!`
            : `Product '${code}' is already in another pending dispatch note!`;
            
          console.log('🚨 Scan bale validation error: pending upload', { isCurrentNote, code });
          setMessage(msg);
          setIsSaving(false);
          return false;
        }
      } catch (pendingError) {
        console.warn('Failed to check pending uploads:', pendingError);
      }

      // 4) Check the 'dispatched' flag on warehouse_shipped_bale
      // Only block if dispatched AND not in a posted dispatch note (posted notes allow re-dispatch)
      if (shippedBale.dispatched === 1) {
        // Check if this bale is in a posted dispatch note - if so, allow re-dispatch
        const inPostedNote = localLines.some(l => {
          const lineNoteId = String(l.dispatch_note_id);
          const isCurrent = noteIdsToMatch.includes(lineNoteId);
          const dispatchNoteState = (l.dispatch_note_state || '').trim().toLowerCase();
          return !isCurrent && dispatchNoteState === 'posted';
        });
        
        if (!inPostedNote) {
        const msg = `Product '${code}' is already dispatched on the server!`;
          console.log('🚨 Scan bale validation error: dispatched flag is 1 and not in posted note', { code, baleId: shippedBale.id });
        setMessage(msg);
        setIsSaving(false);
        return false;
        } else {
          console.log('✅ Bale is dispatched but in posted note - allowing re-dispatch', { code, baleId: shippedBale.id });
        }
      }
    }

    // 5) Check destination warehouse status
    if (shippedBale.warehouse_id && dispatchNote.warehouse_destination_id &&
        String(shippedBale.warehouse_id) === String(dispatchNote.warehouse_destination_id) &&
        shippedBale.stock_status === 'in_stock') {
      const destinationName = dispatchNote.warehouse_destination_name || 'destination warehouse';
      const msg = `Product '${code}' is already in the warehouse '${destinationName}' in the stock status of in_stock!`;
      setMessage(msg);
      setIsSaving(false);
      return false;
    }
    
    // 6) Internal eligibility
    if (dispatchNote.source_wh_type === 'internal') {
      const isReceived = shippedBale.received === 1;
      const status = shippedBale.stock_status;
      const isEligible = isReceived && !(['in_transit', 'out_stock'].includes(status));
      if (!isEligible) {
        const msg = `Product '${code}' is not eligible for dispatch (Status: ${status || 'unknown'}, Received: ${isReceived ? 'Yes' : 'No'})!`;
        setMessage(msg);
        setIsSaving(false);
        return false;
      }
    }

    return true;
  };

  const actionSaveBale = async (scannedCode?: string) => {
    Keyboard.dismiss();
    const codeToProcess = (scannedCode || barcode);
    if (!codeToProcess) {
      setMessage('Please enter a barcode.');
      return;
    }
    setMessage('');
    setIsSaving(true);

    try {
      if (!dispatchNote) {
        setMessage('Dispatch note not loaded. Please go back and try again.');
        setIsSaving(false);
        return;
      }

      const code = codeToProcess;
      const actualDispatchNoteId = dispatchNote.id || dispatchNoteId;

      const shippedBale = await powersync.getOptional<any>(
        `SELECT sb.id, sb.warehouse_id, sb.product_id, sb.grade, sb.mass, sb.received_mass, sb.stock_status, sb.received, sb.dispatched, wh.name AS shipped_warehouse_name
         FROM warehouse_shipped_bale sb
         LEFT JOIN warehouse_warehouse wh ON sb.warehouse_id = wh.id
         WHERE sb.barcode = ? OR sb.logistics_barcode = ?
         LIMIT 1`,
        [code, code]
      );

      if (!shippedBale) {
        setMessage(`Product '${code}' not found in shipped products (searched barcode and logistics barcode)!`);
        setIsSaving(false);
        return;
      }

      console.log('🔍 Scanned Bale Detail:', {
        code,
        id: shippedBale.id,
        dispatched: shippedBale.dispatched,
        status: shippedBale.stock_status
      });

      if (dispatchNote.source_wh_type !== 'external' && shippedBale.warehouse_id && String(shippedBale.warehouse_id) !== String(dispatchNote.warehouse_source_id)) {
        const msg = `Product '${code}' is not in the source warehouse '${dispatchNote.source_wh_name || ''}'. Current Warehouse: ${shippedBale.shipped_warehouse_name || shippedBale.warehouse_id}`;
        setMessage(msg);
        setIsSaving(false);
        return;
      }

      if (dispatchNote.product_id && shippedBale.product_id && String(shippedBale.product_id) !== String(dispatchNote.product_id)) {
        const [baleProduct, noteProduct] = await Promise.all([
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(shippedBale.product_id)]),
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(dispatchNote.product_id)])
        ]);
        const msg = `Product Mismatch!\n\nBale: ${baleProduct?.name || shippedBale.product_id} (Barcode: ${code})\nDispatch: ${noteProduct?.name || dispatchNote.product_id}`;
        setMessage(msg);
        setIsSaving(false);
        return;
      }

      const noteIdsToMatch = [String(dispatchNote.id), String(dispatchNote.mobile_app_id), String(actualDispatchNoteId)].filter(id => id && id !== 'undefined' && id !== 'null');
      const isValid = await _validateShippedBaleForDispatch(shippedBale, code, noteIdsToMatch, actualDispatchNoteId);
      if (!isValid) return;

      const numericWeight = weight ? Number(weight) : null;
      const baleMass = numericWeight || shippedBale.received_mass || shippedBale.mass || 0;
      const now = new Date().toISOString();

      if (dispatchNote.instruction_id) {
        const instructionValid = await _validateAgainstShippingInstruction(shippedBale, code, baleMass, actualDispatchNoteId, now);
        if (!instructionValid) return;
      }

      console.log('🔍 Final check before createDispatchBale:', { actualDispatchNoteId, shippedBaleId: shippedBale.id, code });
      await _createDispatchBale(uuidv4(), actualDispatchNoteId, shippedBale.id, code, logistics_barcode, baleMass, now);
    } catch (error) {
      console.error('Failed to save bale:', error);
      setMessage(`Error saving bale: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  const _createDispatchBale = async (id: string, dispatchNoteId: string, shippedBaleId: any, code: string, logistics_barcode: string, weightVal: number | null, now: string) => {
    console.log('📝 Executing _createDispatchBale:', { id, dispatchNoteId, shippedBaleId, code });
    try {
      await powersync.execute(
        'INSERT INTO warehouse_dispatch_bale (id, dispatch_note_id, shipped_bale_id, barcode, logistics_barcode, shipped_mass, state, origin_document, create_date, write_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, dispatchNoteId, shippedBaleId, code, logistics_barcode || null, weightVal, 'draft', 'warehouse_dispatch_notes', now, now]
      );
      console.log('✅ Local insert successful for bale:', code);
      setBarcode('');
      setLogisticsBarcode('');
      setWeight('');
      setMessage(`Bale ${code} added successfully.`);
      setIsSaving(false);
      setScannerVisible(true);
    } catch (error) {
      setMessage(`Error: Could not save bale ${code} to database.`);
      setIsSaving(false);
      setBarcode(code);
    }
  };

  const lookupLogisticsBarcode = async (barcodeValue: string) => {
    if (!barcodeValue || barcodeValue.trim() === '') {
      setLogisticsBarcode('');
      return;
    }
    try {
      const shippedBale = await powersync.getOptional<any>(
        `SELECT logistics_barcode FROM warehouse_shipped_bale WHERE barcode = ? OR logistics_barcode = ? LIMIT 1`,
        [barcodeValue, barcodeValue]
      );
      if (shippedBale?.logistics_barcode) setLogisticsBarcode(shippedBale.logistics_barcode);
      else setLogisticsBarcode('');
    } catch (error) {
      console.error('Failed to fetch logistics barcode:', error);
    }
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    setScannerVisible(false);
    setTimeout(async () => {
      if (scanningMode === 'bale_barcode') {
        setBarcode(scannedBarcode);
        setWeight('');
        await lookupLogisticsBarcode(scannedBarcode);
      } else {
        setLogisticsBarcode(scannedBarcode);
      }
    }, 0);
  };

  const handleBarcodeChange = (text: string) => {
    setBarcode(text);
    if (barcodeLookupTimeoutRef.current) clearTimeout(barcodeLookupTimeoutRef.current);
    if (text && text.trim().length > 0) {
      barcodeLookupTimeoutRef.current = setTimeout(() => {
        lookupLogisticsBarcode(text.trim());
      }, 500);
    } else {
      setLogisticsBarcode('');
    }
  };

  const actionDone = async () => {
    try {
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
    } catch (error) {
      router.replace('/(app)/inventory/dispatch/warehouse-dispatch-note');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Scan Bales', headerShown: true }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
          <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
            <BarcodeScanner onBarcodeScanned={handleBarcodeScanned} onClose={() => setScannerVisible(false)} scanType="bale" title={scanningMode === 'bale_barcode' ? 'Scan Bale Barcode' : 'Scan Logistics Barcode'} />
          </Modal>

          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">
              {dispatchNote?.reference && dispatchNote?.warehouse_destination_name ? `${dispatchNote.reference} to ${dispatchNote.warehouse_destination_name}` : dispatchNote?.reference || dispatchNote?.name || 'Dispatch Note'}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-base font-semibold text-blue-800 mr-2">Scanned:</Text>
              <Text className="text-lg font-bold text-blue-900">{bale_count}</Text>
              <Text className="text-base font-semibold text-blue-800 ml-1">bales</Text>
            </View>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-3">
              <TextInput className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base" placeholder="Scan or enter barcode here..." value={barcode} onChangeText={handleBarcodeChange} />
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setScannerVisible(true); }} className="p-3 ml-2 bg-gray-200 rounded-lg">
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {weightVisible && (
              <View className="mb-2">
                <TextInput ref={massInputRef} className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base" placeholder="0.00" keyboardType="numeric" value={weight} onChangeText={setWeight} />
              </View>
            )}

            <View className="flex-row items-center">
              <TextInput className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base" placeholder="Logistics barcode (optional)" value={logistics_barcode} onChangeText={setLogisticsBarcode} />
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setScanningMode('logistics_barcode'); setScannerVisible(true); }} className="p-3 ml-2 bg-gray-200 rounded-lg">
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {message ? (
            <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: message.includes('successfully') ? '#d1fae5' : message.includes('Error') || message.includes('cannot') ? '#fee2e2' : '#fef3c7' }}>
              <Text className={`text-center text-base font-semibold ${message.includes('successfully') ? 'text-green-800' : message.includes('Error') || message.includes('cannot') ? 'text-red-800' : 'text-yellow-800'}`}>
                {message}
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => actionSaveBale()} className="flex-1 bg-blue-600 p-4 rounded-lg items-center justify-center flex-row" disabled={isSaving} style={{ opacity: isSaving ? 0.7 : 1 }}>
              {isSaving ? (
                <>
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">Saving...</Text>
                </>
              ) : (
                <Text className="text-white font-bold text-lg">Save Bale</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={actionDone} className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center">
              <Text className="text-white font-bold text-lg">Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default ScanBalesScreen;
