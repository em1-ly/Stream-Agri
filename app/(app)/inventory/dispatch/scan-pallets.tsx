import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useSession } from '@/authContext';

const ScanPalletsScreen = () => {
  const router = useRouter();
  const { session } = useSession();
  const { dispatchNoteId } = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleCount, setBaleCount] = useState(0);
  const [rackCount, setRackCount] = useState(0);
  const [productsDispatched, setProductsDispatched] = useState(0);
  const [dispatchNote, setDispatchNote] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [showManualActions, setShowManualActions] = useState(false);

  useEffect(() => {
    const fetchDispatchNote = async () => {
      if (dispatchNoteId) {
        try {
          // Always refresh the local record to ensure we have latest mobile_app_id
          const note = await powersync.get<any>(
            `SELECT dn.*, wh.name as warehouse_destination_name 
             FROM warehouse_dispatch_note dn
             LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
             WHERE dn.id = ? OR dn.mobile_app_id = ?`, 
            [dispatchNoteId, dispatchNoteId]
          );
          setDispatchNote(note);
          // Note: warehouse dispatch bale counting may need to be updated based on actual table structure
          // For now, using a placeholder query - this may need adjustment based on your schema
          const countResult = await powersync.getOptional<{ count: number }>(
            'SELECT COUNT(*) as count FROM warehouse_dispatch_bale WHERE dispatch_note_id = ? OR dispatch_note_id = ?', 
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
    Keyboard.dismiss();
    const codeToProcess = scannedCode || barcode;
    if (!codeToProcess) {
      const msg = 'Please enter a rack barcode.';
      setMessage(msg);
      return;
    }
    setMessage('');

    try {
      if (!dispatchNote) {
        const msg = 'Dispatch note not loaded. Please go back and try again.';
        setMessage(msg);
        return;
      }

      const code = codeToProcess.trim();
      const actualDispatchNoteId = dispatchNote.id || dispatchNoteId;
      const now = new Date().toISOString();

      // Load source warehouse info for validations (type + name)
      const sourceWarehouse = dispatchNote.warehouse_source_id
        ? await powersync.getOptional<any>(
            'SELECT id, name, warehouse_type FROM warehouse_warehouse WHERE id = ?',
            [String(dispatchNote.warehouse_source_id)]
          )
        : null;

      // 1) Find rack/pallet by barcode
      const pallet = await powersync.getOptional<any>(
        'SELECT id, warehouse_id FROM warehouse_pallet WHERE barcode = ? LIMIT 1',
        [code]
      );

      if (!pallet) {
        const msg =
          sourceWarehouse?.warehouse_type === 'external'
            ? `Rack '${code}' not found! For external warehouses, please create the rack first through the Rack management interface.`
            : `Rack '${code}' not found!`;
        setMessage(msg);
        return;
      }

      // 2) Get all shipped products for this rack
      const shippedBales = await powersync.getAll<any>(
        `SELECT id, warehouse_id, stock_status, received, barcode, logistics_barcode, pallet_id
         FROM warehouse_shipped_bale
         WHERE pallet_id = ?`,
        [pallet.id]
      );
      
      if (!shippedBales || shippedBales.length === 0) {
        const msg =
          sourceWarehouse?.warehouse_type === 'external'
            ? `No products found for rack '${code}'! Please add products to this rack first.`
            : `No products found for rack '${code}'!`;
        setMessage(msg);
        return;
      }

      // 3) Internal warehouse validations: check warehouse and eligibility
      if (sourceWarehouse?.warehouse_type !== 'external') {
        const wrongWarehouse = shippedBales.filter(
          (b: any) => b.warehouse_id && String(b.warehouse_id) !== String(sourceWarehouse?.id)
        );
        if (wrongWarehouse.length > 0) {
          const msg = `Some products from rack '${code}' are not in the source warehouse '${sourceWarehouse?.name || ''}'. Cannot dispatch entire rack.`;
          setMessage(msg);
          return;
        }

        const ineligible = shippedBales.filter(
          (b: any) =>
            (b.stock_status && ['in_transit', 'out_stock'].includes(String(b.stock_status))) ||
            !b.received
        );
        if (ineligible.length > 0) {
          const ineligibleList = ineligible
            .map((b: any) => b.barcode)
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
          const msg = `Some products from rack '${code}' are not eligible for dispatch (not received or in wrong stock state): ${ineligibleList}${
            ineligible.length > 3 ? '...' : ''
          }`;
          setMessage(msg);
          return;
        }
      }

      // 3b) Product Match Check
      if (dispatchNote.product_id && 
          shippedBales.some(b => b.product_id && String(b.product_id) !== String(dispatchNote.product_id))) {
        const mismatchBales = shippedBales.filter(b => b.product_id && String(b.product_id) !== String(dispatchNote.product_id));
        const [firstMismatchProduct, noteProduct] = await Promise.all([
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(mismatchBales[0].product_id)]),
          powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(dispatchNote.product_id)])
        ]);
        const msg = `Product Mismatch on Rack!\n\n` +
                    `Some bales are '${firstMismatchProduct?.name || mismatchBales[0].product_id}', but this dispatch is for '${noteProduct?.name || dispatchNote.product_id}'.`;
        console.log('🚨 Scan rack validation error', { 
          reason: 'product_mismatch', 
          code, 
          mismatchCount: mismatchBales.length,
          noteProduct: dispatchNote.product_id,
          message: msg 
        });
        setMessage(msg);
        return;
      }

      // 4) Already dispatched check (draft lines)
      const shippedIds = shippedBales.map((b: any) => b.id);
      const placeholders = shippedIds.map(() => '?').join(',');
      const alreadyDispatched =
        shippedIds.length > 0
          ? await powersync.getAll<any>(
              `SELECT db.shipped_bale_id, sb.barcode
               FROM warehouse_dispatch_bale db
               LEFT JOIN warehouse_shipped_bale sb ON db.shipped_bale_id = sb.id
               WHERE db.shipped_bale_id IN (${placeholders}) AND db.state = 'draft'`,
              shippedIds
            )
          : [];

      if (alreadyDispatched && alreadyDispatched.length > 0) {
        const list = alreadyDispatched
          .map((d: any) => d.barcode)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        const msg = `Some products from rack '${code}' are already in draft dispatched: ${list}${
          alreadyDispatched.length > 3 ? '...' : ''
        }`;
        setMessage(msg);
        return;
      }

      // 5) Validation against shipping instructions for all products on the rack
      if (dispatchNote.instruction_id) {
        const issues = [];
        let totalRackMass = 0;

        console.log('🔍 Validating Rack against Instruction:', {
          instruction_id: dispatchNote.instruction_id,
          baleCount: shippedBales.length
        });

        for (const bale of shippedBales) {
          const instructionLine = await powersync.getOptional<any>(
            `SELECT * FROM warehouse_instruction_line 
             WHERE instruction_id = ? AND product_id = ? AND grade_id = ?`,
            [Number(dispatchNote.instruction_id), Number(bale.product_id), Number(bale.grade)]
          );

          if (!instructionLine) {
            const [product, grade] = await Promise.all([
              powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(bale.product_id)]),
              powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(bale.grade)])
            ]);
            issues.push(`Bale '${bale.barcode}': ${product?.name || bale.product_id} with grade ${grade?.name || bale.grade} not allowed.`);
            continue;
          }

          const baleMass = bale.received_mass || bale.mass || 0;
          totalRackMass += baleMass;
          const remainingMass = instructionLine.remaining_mass || 0;

          if (remainingMass < baleMass) {
            const product = await powersync.getOptional<any>('SELECT name FROM warehouse_product WHERE id = ?', [String(bale.product_id)]);
            const grade = await powersync.getOptional<any>('SELECT name FROM warehouse_bale_grade WHERE id = ?', [String(bale.grade)]);
            issues.push(`${product?.name || bale.product_id} - ${grade?.name || bale.grade}: Exceeds limit by ${(baleMass - remainingMass).toFixed(2)} kg`);
          }
        }

        if (issues.length > 0) {
          const instruction = await powersync.getOptional<any>('SELECT name FROM warehouse_instruction WHERE id = ?', [String(dispatchNote.instruction_id)]);
          const instructionName = instruction?.name || `ID:${dispatchNote.instruction_id}`;

          const msg = `WARNING: Shipping instruction violations on rack '${code}' for instruction '${instructionName}':\n\n` +
                      issues.slice(0, 5).join('\n') +
                      (issues.length > 5 ? '\n...' : '') +
                      `\n\nTotal rack mass: ${totalRackMass.toFixed(2)} kg\n\n` +
                      `Click 'Confirm Override' to proceed anyway.`;

          Alert.alert(
            'Dispatch Warning',
            msg,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setMessage('Rack addition cancelled.') },
              { 
                text: 'Confirm Override', 
                style: 'destructive', 
                onPress: () => processRackInsertion(shippedBales, actualDispatchNoteId, code, now) 
              }
            ]
          );
          return;
        }
      }

      // 6) Insert dispatch lines for all bales on the rack
      await processRackInsertion(shippedBales, actualDispatchNoteId, code, now);

    } catch (error) {
      console.error('Failed to save rack:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const msg = `Error saving rack: ${errorMessage}`;
      setMessage(msg);
    } finally {
      // Clear the barcode so the overlay/input resets without needing another tap
      setBarcode('');
    }
  };

  const processRackInsertion = async (shippedBales: any[], actualDispatchNoteId: string, code: string, now: string) => {
    // Create dispatch lines for all bales on the rack
    for (const bale of shippedBales) {
      const newLineId = uuidv4();
      await powersync.execute(
        `INSERT INTO warehouse_dispatch_bale (
          id, 
          dispatch_note_id, 
          shipped_bale_id, 
          shipped_pallet_id, 
          barcode, 
          logistics_barcode, 
          state, 
          origin_document, 
          create_date, 
          write_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newLineId,
          actualDispatchNoteId,
          bale.id,
          bale.pallet_id,
          bale.barcode,
          bale.logistics_barcode, // Preserving original bale logistics barcode (Luggage Label)
          'draft',
          'dispatch_pallet',
          now,
          now,
        ]
      );
    }

    setMessage(`Rack '${code}' dispatched successfully! Ready for next rack scan.`);
    // Use shipped bales count for UI feedback
    setBaleCount((prev) => prev + shippedBales.length);
    setRackCount((prev) => prev + 1);
    setProductsDispatched((prev) => prev + shippedBales.length);
    setBarcode(''); // Clear input for next scan
    
    // Automatically open camera for next scan
    setTimeout(() => {
      Keyboard.dismiss();
      setScannerVisible(true);
    }, 300);
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    // 1) Hide the scanner instantly for better UX
    setScannerVisible(false);
    
    // 2) Defer the processing to the next tick
    setTimeout(() => {
    setShowManualActions(false);
    handleSaveBale(scannedBarcode);
    }, 0);
  };

  const handleDone = async () => {
    try {
      // Always refresh the local record to ensure we have latest mobile_app_id
      let note = null;
      if (dispatchNoteId) {
        note = await powersync.getOptional<any>(
          'SELECT id, mobile_app_id FROM warehouse_dispatch_note WHERE id = ? OR mobile_app_id = ?',
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
        // Navigate to the specific warehouse dispatch note detail
        router.replace({
          pathname: '/(app)/inventory/dispatch/warehouse-dispatch-note-details',
          params: { id: String(targetId) },
        });
      } else {
        // Fallback: go back to the dispatch note list
        router.replace('/(app)/inventory/dispatch/warehouse-dispatch-note');
      }
    } catch (error) {
      console.error('🔁 handleDone fallback due to error', error);
      router.replace('/(app)/inventory/dispatch/warehouse-dispatch-note');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Scan Pallets', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View className="flex-1 p-5">
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Pallet Barcode"
          displayInfo={{
            gdnNumber: dispatchNote?.reference,
            rack: barcode,
            progress: { scanned: rackCount, total: 0 },
          }}
        />
        {/* Overlay to show live status while camera is open */}
        <View className="absolute top-24 left-0 right-0 p-4 bg-black/70 items-center">
          <Text className="text-white text-base mb-1 font-semibold text-center">
            Rack barcode: {barcode || '—'}
          </Text>
          <Text className="text-white text-lg mb-1 text-center">
            Racks dispatched: {rackCount} • Products dispatched: {productsDispatched}
          </Text>
          {message ? (
            <Text
              className={`text-lg text-center ${
                message.toLowerCase().includes('error') || message.toLowerCase().includes('not') || message.toLowerCase().includes('cannot')
                  ? 'text-red-500'
                  : 'text-green-500'
              }`}
            >
              {message}
            </Text>
          ) : null}
        </View>
      </Modal>

      {/* Header Section - Matching Odoo Wizard View */}
      <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
        <Text className="text-lg font-bold text-blue-900 mb-2">
          {dispatchNote?.reference && dispatchNote?.warehouse_destination_name 
            ? `${dispatchNote.reference} to ${dispatchNote.warehouse_destination_name}`
            : dispatchNote?.reference || dispatchNote?.name || 'Dispatch Note'}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-blue-800 ml-3">Racks:</Text>
          <Text className="text-lg font-bold text-blue-900">{rackCount}</Text>
          <Text className="text-base font-semibold text-blue-800 ml-3">Products:</Text>
          <Text className="text-lg font-bold text-blue-900">{productsDispatched}</Text>
        </View>
      </View>

          {/* Barcode + Extra Details Input Section */}
      <View className="mb-4">
            <View className="flex-row items-center mb-3">
          <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or enter rack barcode here..."
              value={barcode}
              onChangeText={setBarcode}
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

      {/* Message Section */}
      {message ? (
        <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: message.includes('successfully') ? '#d1fae5' : message.includes('Error') || message.includes('cannot') ? '#fee2e2' : '#fef3c7' }}>
          <Text className={`text-center text-base font-semibold ${message.includes('successfully') ? 'text-green-800' : message.includes('Error') || message.includes('cannot') ? 'text-red-800' : 'text-yellow-800'}`}>
            {message}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {showManualActions && (
        <TouchableOpacity
          onPress={() => handleSaveBale()}
          className="flex-1 bg-blue-600 p-4 rounded-lg items-center justify-center"
        >
            <Text className="text-white font-bold text-lg">Dispatch Rack</Text>
        </TouchableOpacity>
        )}
        
        <TouchableOpacity
          onPress={handleDone}
          className={`flex-1 p-4 rounded-lg items-center justify-center ${showManualActions ? 'bg-green-600' : 'bg-green-600'}`}
        >
          <Text className="text-white font-bold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
    </View>
      </KeyboardAvoidingView>
    </>
  );
};

export default ScanPalletsScreen;
