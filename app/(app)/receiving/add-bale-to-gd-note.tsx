import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Search, Camera } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord, HessianRecord } from '@/powersync/Schema';
import * as SecureStore from 'expo-secure-store';

// Toggle to enable/disable verbose logs for the save bale flow
const DEBUG_SAVE_LOGS = false;

// Code 39 check digit validation
const validateCheckDigit = (barcode: string): boolean => {
  console.log('🔍 Validating barcode as Code 39:', barcode);

  if (!barcode || barcode.length !== 10) {
    console.log('❌ Barcode is not 10 characters long for Code 39 validation');
    return false;
  }

  const code39Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
  const data = barcode.slice(0, -1);
  const checkChar = barcode.slice(-1);

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const value = code39Chars.indexOf(char.toUpperCase());
    
    if (value === -1) {
      console.log(`❌ Invalid Code 39 character found: ${char}`);
      return false; // Invalid character
    }
    
    sum += value;
  }
  
  const checkDigitIndex = sum % 43;
  const calculatedCheckChar = code39Chars[checkDigitIndex];
  
  const isValid = calculatedCheckChar === checkChar;

  console.log(`🔍 Code 39 validation: Data=${data}, Check=${checkChar}, Calculated=${calculatedCheckChar}, Valid=${isValid}`);
    
  return isValid;
};

export default function AddBaleToGDNoteScreen() {
  const [documentNumber, setDocumentNumber] = useState('');
  const [growerNote, setGrowerNote] = useState<GrowerDeliveryNoteRecord | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const lastProcessedBarcode = useRef<string>('');
  const lastProcessedBaleBarcode = useRef<string>('');

  const [scaleBarcode, setScaleBarcode] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [hessian, setHessian] = useState('');
  const [hessianId, setHessianId] = useState<string | number | null>(null);
  const [hessians, setHessians] = useState<{ id: number; name: string; hessian_id: string }[]>([]);
  const [location, setLocation] = useState('');
  const [locationId, setLocationId] = useState<string | number | null>(null);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false); // no longer used with dropdown
  const [isClosing, setIsClosing] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>('');

  const toInt = (val: string) => {
    const n = parseInt((val || '').trim(), 10);
    return isNaN(n) ? null : n;
  };

  const validateBaleEntry = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const errors: string[] = [];
    // 1) Document
    if (!growerNote || !documentNumber.trim()) {
      errors.push('Please enter a valid document number');
    }
    // 2) Bale barcode validation
    if (!scaleBarcode || !validateCheckDigit(scaleBarcode)) {
      errors.push('Please enter a valid 10-character bale barcode');
    }
    // 3) Lot number
    if (!lotNumber.trim()) {
      errors.push('Please enter a Lot Number');
    }
    // 4) Group number must be integer
    if (!groupNumber.trim()) {
      errors.push('Please enter a Group Number');
    } else if (toInt(groupNumber) === null) {
      errors.push('Please enter an integer for group number');
    }
    // 5) Hessian validation
    if (!hessian.trim()) {
      errors.push('Please select a Hessian');
    }
    // 8) Existing bale associations
    if (scaleBarcode) {
      try {
        const existingRows = await powersync.getAll<any>(
          'SELECT id, grower_delivery_note_id, document_number FROM receiving_bale WHERE scale_barcode = ? LIMIT 1',
          [scaleBarcode]
        );
        const existing = existingRows && existingRows[0];
        if (existing && existing.grower_delivery_note_id) {
          // Check old note state
          try {
            const oldRows = await powersync.getAll<GrowerDeliveryNoteRecord>(
              'SELECT id, document_number, grower_number, state FROM receiving_grower_delivery_note WHERE id = ? LIMIT 1',
              [existing.grower_delivery_note_id]
            );
            const oldNote = oldRows && oldRows[0];
            if (oldNote && oldNote.state && oldNote.state !== 'open') {
              errors.push(
                `Bale is already associated with a Closed Document # ${oldNote.document_number} for Grower ${oldNote.grower_number}`
              );
            }
          } catch (e) {
            errors.push('Could not verify previous association state (local DB error).');
          }
        }
      } catch (e) {
        errors.push('Could not check existing bale association (local DB error).');
      }
    }
    // 9) Exceed expected bales
    if (growerNote) {
      try {
        const countRows = await powersync.getAll<{ count: number }>(
          'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
          [growerNote.id, growerNote.document_number]
        );
        const actual = (countRows && countRows[0]?.count) || 0;
        const expected = growerNote.number_of_bales_delivered || 0;
        if (actual >= expected) {
          errors.push(`Cannot add more bales: Already scanned ${actual} out of ${expected} expected bales`);
        }
      } catch (e) {
        errors.push('Could not verify scanned bale count (local DB error).');
      }
    }
    // 10) Location validation (best-effort, optional table)
    if (location && location.trim()) {
      try {
        const loc = await powersync.get<any>(
          'SELECT id FROM floor_maintenance_bale_location WHERE UPPER(name) = UPPER(?) AND COALESCE(section, "receiving") = "receiving" LIMIT 1',
          [location.trim()]
        );
        if (!loc) {
          errors.push('Please check the location you have entered');
        }
      } catch (_e) {
        // Table might not exist locally; ignore hard-fail
      }
    }

    if (errors.length) {
      return { ok: false, error: errors.join('\n') };
    }
    return { ok: true };
  };

  // Listen for scanned document barcode from the scanner screen
  useEffect(() => {
    console.log('Received params:', params);
    if (params.scannedBarcode && 
        typeof params.scannedBarcode === 'string' && 
        params.scannedBarcode !== 'undefined' &&
        params.scannedBarcode !== lastProcessedBarcode.current) {
      console.log('Processing scanned barcode:', params.scannedBarcode);
      lastProcessedBarcode.current = params.scannedBarcode;
      setDocumentNumber(params.scannedBarcode);
      // Auto-search after scanning
      handleSearchWithBarcode(params.scannedBarcode);
    }
  }, [params.scannedBarcode]);

  // Listen for scanned bale barcode from the scanner screen
  useEffect(() => {
    if (params.scannedBaleBarcode && 
        typeof params.scannedBaleBarcode === 'string' && 
        params.scannedBaleBarcode !== 'undefined' &&
        params.scannedBaleBarcode !== lastProcessedBaleBarcode.current) {
      console.log('Processing scanned bale barcode:', params.scannedBaleBarcode);
      lastProcessedBaleBarcode.current = params.scannedBaleBarcode;
      setScaleBarcode(params.scannedBaleBarcode);
      
      // If preserveState is true, restore the document number and refetch the grower note
      if (params.preserveState === 'true' && params.documentNumber && typeof params.documentNumber === 'string') {
        console.log('Restoring document number and refetching grower note:', params.documentNumber);
        setDocumentNumber(params.documentNumber);
        handleSearchWithBarcode(params.documentNumber);
      }
    }
  }, [params.scannedBaleBarcode]);

  // Load available hessians from Odoo (via PowerSync) once
  useEffect(() => {
    const loadHessians = async () => {
      try {
        const rows = await powersync.getAll<{ id: number; name: string; hessian_id: string }>(
          'SELECT id, name, hessian_id FROM receiving_hessian WHERE COALESCE(active, 1) = 1 ORDER BY name'
        );
        setHessians(rows as any);
      } catch (e) {
        // ignore if table not present
      }
    };
    loadHessians();
  }, []);

  // Load available locations from Odoo (via PowerSync) once
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const rows = await powersync.getAll<{ id: number; name: string }>(
          'SELECT id, name FROM floor_maintenance_bale_location WHERE COALESCE(section, "receiving") = "receiving" AND COALESCE(active, 1) = 1 ORDER BY name'
        );
        setLocations(rows as any);
      } catch (e) {
        // ignore if table not present
      }
    };
    loadLocations();
  }, []);

  // Refresh grower note data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshGrowerNote = async () => {
        if (growerNote && growerNote.document_number) {
          console.log('🔄 Refreshing GD Note details...');
          try {
            // Trigger PowerSync refresh
            await powersync.execute('SELECT 1');
            
            // Wait a moment for sync
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Re-fetch the grower note data
            const updatedResult = await powersync.get<GrowerDeliveryNoteRecord>(
              'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
              [growerNote.document_number]
            );
            
            if (updatedResult) {
              console.log('📋 Refreshed grower note data:', updatedResult);
              
              // Count actual bales
              try {
                const baleCount = await powersync.get<{ count: number }>(
                  'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
                  [updatedResult.id, updatedResult.document_number]
                );
                console.log('📦 Refreshed bale count:', baleCount?.count || 0);
                
                setGrowerNote({
                  ...updatedResult,
                  number_of_bales: baleCount?.count || 0
                });
              } catch (countError) {
                // silently ignore counting errors on refresh
                setGrowerNote(updatedResult);
              }
            }
          } catch (error) {
            // silently ignore refresh errors
          }
        }
      };
      
      refreshGrowerNote();
    }, [growerNote?.document_number])
  );

  const handleSearchWithBarcode = async (barcode: string) => {
    if (!barcode) {
      return;
    }
    try {
      const result = await powersync.get<GrowerDeliveryNoteRecord>(
        'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
        [barcode]
      );
      if (result) {
        setGrowerNote(result);
      } else {
        setGrowerNote(null);
        Alert.alert('Not Found', `Grower Delivery Note with Document Number "${barcode}" not found.`);
      }
    } catch (error) {
      // silently ignore fetch errors
      Alert.alert('Error', 'An error occurred while fetching the delivery note.');
    }
  };

  const handleNavigateToAddBale = () => {
    if (!hessianId || !locationId) {
      Alert.alert('Configuration Incomplete', 'Please select both a Hessian and a Location before adding bales.');
      return;
    }
    router.push({
      pathname: '/receiving/add-new-bale',
      params: { 
        documentNumber: documentNumber,
        hessianId: hessianId,
        locationId: locationId,
        hessianName: hessian,
        locationName: location
      }
    });
  };

  const handleSearch = async () => {
    console.log('🔍 Searching for grower note with document number:', documentNumber);
    if (!documentNumber.trim()) {
      Alert.alert('Error', 'Please enter a Document Number.');
      return;
    }
    try {
      const result = await powersync.get<GrowerDeliveryNoteRecord>(
        'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
        [documentNumber.trim()]
      );
      if (result) {
        console.log('📋 Full grower note data:', result);
        console.log('📊 number_of_bales value:', result.number_of_bales);
        console.log('📊 number_of_bales type:', typeof result.number_of_bales);
        console.log('📊 number_of_bales_delivered value:', result.number_of_bales_delivered);
        console.log('📊 All result keys:', Object.keys(result));
        console.log('📊 Raw number_of_bales:', result.number_of_bales);
        console.log('📊 Raw number_of_bales_delivered:', result.number_of_bales_delivered);
        console.log('🆔 Delivery Note ID:', result.id);
        console.log('📄 Document Number:', result.document_number);
        
        // Count actual bales in the database for this delivery note
        try {
          console.log('🔍 Counting bales in database...');
          const baleCount = await powersync.get<{ count: number }>(
            'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
            [result.id, result.document_number]
          );
          console.log('📦 Actual bale count in database:', baleCount?.count || 0);
          console.log('📦 Full baleCount object:', baleCount);
    
          
          // Update the result with the actual scanned count
          if (baleCount) {
            result.number_of_bales = baleCount.count;
          }
        } catch (countError) {
          // silently ignore counting errors
          Alert.alert('Error', 'Failed to count bales: ' + String(countError));
        }
        
        setGrowerNote(result);
      } else {
        setGrowerNote(null);
        Alert.alert('Not Found', `Grower Delivery Note with Document Number "${documentNumber}" not found.`);
      }
    } catch (error) {
      // silently ignore fetch errors
      Alert.alert('Error', 'An error occurred while fetching the delivery note.');
    }
  };

  const handleSaveBale = async () => {
    if (!growerNote) {
      Alert.alert('Error', 'No Grower Delivery Note selected.');
      return;
    }

    if (!scaleBarcode || !lotNumber || !groupNumber || !hessian || !location) {
      Alert.alert('Error', 'Please fill in all bale details including hessian.');
      return;
    }

    try {
      // Validation parity with Odoo wizard
      const validation = await validateBaleEntry();
      if (!validation.ok) {
        setValidationMessage(validation.error);
        Alert.alert('Validation Error', validation.error);
        return;
      }

      // Resolve hessian_id from name if possible (best-effort)
      let hessianIdToUse: any = hessianId ?? hessian;
      try {
        const hessianRows = await powersync.getAll<any>(
          'SELECT id FROM receiving_hessian WHERE UPPER(name) = UPPER(?) AND COALESCE(active, 1) = 1 LIMIT 1',
          [hessian.trim()]
        );
        if (hessianRows && hessianRows[0]?.id != null) {
          hessianIdToUse = hessianRows[0].id;
        }
      } catch (_e) {
        // ignore lookup errors
      }

      // Resolve location_id from name if possible (best-effort)
      // Prefer selected location id if available; else try resolve from name
      let locationIdToUse: any = locationId ?? location;
      try {
        const locRows = await powersync.getAll<any>(
          'SELECT id FROM floor_maintenance_bale_location WHERE UPPER(name) = UPPER(?) AND COALESCE(section, "receiving") = "receiving" LIMIT 1',
          [location.trim()]
        );
        if (locRows && locRows[0]?.id != null) {
          locationIdToUse = locRows[0].id;
        }
      } catch (_e) {
        // ignore lookup errors
      }
      const baleId = uuidv4();
      const now = new Date().toISOString();

      const baleData = {
        id: baleId,
        grower_delivery_note_id: growerNote.id,
        document_number: growerNote.document_number,
        scale_barcode: scaleBarcode,
        barcode: scaleBarcode,
        lot_number: lotNumber,
        group_number: toInt(groupNumber),
        hessian_id: hessianIdToUse,
        location_id: locationIdToUse,
        create_date: now,
        write_date: now,
        mass: 0,
        state: 'open'
      };

      if (DEBUG_SAVE_LOGS) console.log('📦 Saving bale to PowerSync:', baleData);

      await powersync.execute(
        'INSERT INTO receiving_bale (id, grower_delivery_note_id, document_number, scale_barcode, barcode, lot_number, group_number, hessian_id, location_id, create_date, write_date, mass, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          baleData.id,
          baleData.grower_delivery_note_id,
          baleData.document_number,
          baleData.scale_barcode,
          baleData.barcode,
          baleData.lot_number,
          baleData.group_number,
          baleData.hessian_id,
          baleData.location_id,
          baleData.create_date,
          baleData.write_date,
          baleData.mass,
          baleData.state
        ]
      );
      
      const successMessage = `Bale ${scaleBarcode} saved locally.`;
      Alert.alert('Success', successMessage);

      // Clear form fields
      setScaleBarcode('');
      setLotNumber('');
      setGroupNumber('');
      setHessian('');
      setHessianId(null);
      // setLocation('');

      // Trigger PowerSync refresh to get the latest data from the server
      try {
        if (DEBUG_SAVE_LOGS) console.log('🔄 Triggering PowerSync refresh...');
        await powersync.execute('SELECT 1'); // This triggers a sync
        if (DEBUG_SAVE_LOGS) console.log('✅ PowerSync refresh triggered');
        
        // Wait a moment for the sync to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-fetch the grower note data to get the updated bale count
      if (growerNote) {
          if (DEBUG_SAVE_LOGS) console.log('🔄 Re-fetching grower note data...');
          const updatedResult = await powersync.get<GrowerDeliveryNoteRecord>(
            'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
            [growerNote.document_number]
          );
          
          if (updatedResult) {
            if (DEBUG_SAVE_LOGS) console.log('📋 Updated grower note data:', updatedResult);
            if (DEBUG_SAVE_LOGS) console.log('📊 Updated number_of_bales:', updatedResult.number_of_bales);
            
            // Count actual bales in the database for this delivery note
        try {
          const baleCount = await powersync.get<{ count: number }>(
            'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
                [updatedResult.id, updatedResult.document_number]
              );
              if (DEBUG_SAVE_LOGS) console.log('📦 Updated bale count from database:', baleCount?.count || 0);
              
              // Update the grower note with the fresh data
              setGrowerNote({
                ...updatedResult,
                number_of_bales: baleCount?.count || 0
              });
            } catch (countError) {
              if (DEBUG_SAVE_LOGS) console.log('❌ Error counting bales:', countError);
              // Still update with the server data even if count fails
              setGrowerNote(updatedResult);
            }
          }
        }
      } catch (refreshError) {
        if (DEBUG_SAVE_LOGS) console.log('❌ Error refreshing data:', refreshError);
        // If refresh fails, still try to update the local state
        if (growerNote) {
          setGrowerNote((prevNote) => {
            if (!prevNote) return null;
            return {
              ...prevNote,
              number_of_bales: (prevNote.number_of_bales || 0) + 1
            };
          });
        }
      }
    } catch (error: any) {
      if (DEBUG_SAVE_LOGS) console.log('❌ Failed to save bale:', error);
      
      // Provide more specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        Alert.alert('Network Error', 'Unable to connect to the server. Please check your internet connection.');
      } else if (error.message && error.message.includes('JSON')) {
        Alert.alert('Server Error', 'Invalid response from server. Please try again.');
      } else {
        Alert.alert('Error', `An error occurred while saving the bale: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleCloseDelivery = async () => {
    if (!growerNote) return;
    
    // Local validation 1: Check if delivery note has been booked
    // Query receiving_grower_bookings table to check if has_been_booked = 1 using grower number
    let hasBeenBooked = false;
    
    // First check if has_been_booked is set on the delivery note itself
    if (growerNote.has_been_booked === 1) {
      hasBeenBooked = true;
    } else if (growerNote.grower_number) {
      // If not booked via delivery note field, check receiving_grower_bookings table
      try {
        // Query receiving_grower_bookings table to check if has_been_booked = 1 for this grower
        const booking = await powersync.get<any>(
          `SELECT has_been_booked FROM receiving_grower_bookings WHERE grower_number = ? AND has_been_booked = 1 LIMIT 1`,
          [growerNote.grower_number]
        );
        
        if (booking && booking.has_been_booked === 1) {
          hasBeenBooked = true;
          console.log(`📋 Booking found in receiving_grower_bookings - has_been_booked: ${booking.has_been_booked} (BOOKED) for grower ${growerNote.grower_number}`);
        } else {
          console.log(`📋 No booking with has_been_booked=1 found in receiving_grower_bookings for grower ${growerNote.grower_number}`);
        }
      } catch (bookingError: any) {
        // PowerSync's get() throws "Result set is empty" when no record found - this is expected
        if (bookingError?.message?.includes('empty') || bookingError?.message?.includes('Result set')) {
          // This is normal - no booking record exists or has_been_booked is not 1
          console.log(`📋 No booking with has_been_booked=1 found in receiving_grower_bookings for grower ${growerNote.grower_number}`);
        } else {
          // Actual error occurred
          console.warn('⚠️ Failed to check receiving_grower_bookings:', bookingError);
        }
      }
    } else {
      console.log(`📋 No grower_number found for delivery note ${growerNote.document_number}, cannot check booking status`);
    }
    
    console.log(`📋 Booking status check - has_been_booked: ${growerNote.has_been_booked} (type: ${typeof growerNote.has_been_booked}), isBooked: ${hasBeenBooked}`);
    if (!hasBeenBooked) {
      Alert.alert(
        'Cannot Close', 
        `Delivery note ${growerNote.document_number} must be booked before it can be closed.\n\nPlease ensure the delivery note has been booked first.`
      );
      return;
    }
    
    // Local validation 2: Check state (matches Odoo visibility condition)
    if (growerNote.state === 'hold') {
      Alert.alert(
        'Validation Error',
        'Cannot close delivery note: Delivery is on hold'
      );
      return;
    }
    
    if (growerNote.state !== 'open') {
      Alert.alert(
        'Validation Error',
        `Cannot close delivery note: State is '${growerNote.state}', must be 'open'`
      );
      return;
    }
    
    // Local validation 3: Validate that all expected bales are scanned
    const expected = growerNote.number_of_bales_delivered || 0;
    const scanned = growerNote.number_of_bales || 0;
    if (scanned < expected) {
      Alert.alert(
        'Validation Error',
        `Cannot close delivery note: Only scanned ${scanned} out of ${expected} expected bales`
      );
      return;
    }
    
    try {
      setIsClosing(true);
      
      // Update the state locally and let PowerSync handle the sync
      await powersync.execute(
        'UPDATE receiving_grower_delivery_note SET state = ? WHERE id = ?',
        ['checked', growerNote.id]
      );
      
      console.log('✅ Delivery note closed successfully locally:', growerNote.document_number);
      
      // Show acknowledgement only
      const successMessage = `Delivery note ${growerNote.document_number} marked for closing.`;
      Alert.alert('Success', successMessage, [{ text: 'OK' }]);
      
      // Trigger PowerSync refresh to get the updated state
      try {
        console.log('🔄 Triggering PowerSync refresh after closing delivery note...');
        await powersync.execute('SELECT 1'); // This triggers a sync
        console.log('✅ PowerSync refresh triggered');
        
        // Wait a moment for the sync to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-fetch the grower note data to get the updated state
        if (growerNote) {
          console.log('🔄 Re-fetching grower note data after closing...');
          const updatedResult = await powersync.get<GrowerDeliveryNoteRecord>(
            'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
            [growerNote.document_number]
          );
          
          if (updatedResult) {
            console.log('📋 Updated grower note data after closing:', updatedResult);
            setGrowerNote(updatedResult);
          }
        }
      } catch (refreshError) {
        // silently ignore refresh errors after closing
        // Still show success even if refresh fails
      }
      
      // Optionally navigate back after close
      // router.back();
      
    } catch (error: any) {
      // silently ignore console log; Alert is shown
      
      // Provide more specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        Alert.alert('Network Error', 'Unable to connect to the server. Please check your internet connection.');
      } else if (error.message && error.message.includes('JSON')) {
        Alert.alert('Server Error', 'Invalid response from server. Please try again.');
      } else {
        Alert.alert('Error', `An error occurred while closing the delivery note: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#65435C]"
    >
      <Stack.Screen options={{title: 'Add Bale to GD Note', headerShown: true }} />
      <ScrollView 
        className="flex-1 bg-white rounded-2xl p-5 m-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text className="text-xl font-bold text-[#65435C] mb-4">Find Grower Delivery Note</Text>

        <View className="flex-row mb-5">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            placeholder="Document Number"
            value={documentNumber}
            onChangeText={setDocumentNumber}
          />
          <TouchableOpacity 
            className="bg-[#65435C] rounded-lg p-3 ml-2 justify-center" 
            onPress={() => router.push({
              pathname: '/receiving/barcode-scanner',
              params: { scanType: 'document' }
            })}
          >
            <Camera color="white" size={20} />
          </TouchableOpacity>
          <TouchableOpacity className="bg-[#65435C] rounded-lg p-3 ml-2 justify-center" onPress={handleSearch}>
            <Search color="white" size={20} />
          </TouchableOpacity>
        </View>

        {growerNote && (
          <View className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
              Delivery Note Details
            </Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-base text-gray-600 font-medium">Grower Number:</Text>
              <Text className="text-base text-gray-800">{growerNote.grower_number}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-base text-gray-600 font-medium">Bales Scanned:</Text>
              <Text className="text-base text-gray-800">{growerNote.number_of_bales || 0}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-base text-gray-600 font-medium">Bales Delivered:</Text>
              <Text className="text-base text-gray-800">{growerNote.number_of_bales_delivered || 0}</Text>
            </View>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
              <Text className="text-base text-gray-600 font-semibold">Scanning Progress</Text>
              <Text className="text-base text-gray-800 font-bold">{(growerNote.number_of_bales || 0)} / {(growerNote.number_of_bales_delivered || 0)}</Text>
            </View>
            {(growerNote.number_of_bales || 0) === (growerNote.number_of_bales_delivered || 0) && (
              <View className="mt-2 bg-green-50 border border-green-200 rounded-md p-2">
                <Text className="text-green-700 text-sm">All the bales have been scanned.</Text>
              </View>
            )}
           
          </View>
        )}

        {growerNote && (
          <>
            <Text className="text-xl font-bold text-[#65435C] mb-1">Configure Session</Text>
            {/* Hessian dropdown */}
            <View className="border border-gray-300 rounded-lg px-2 py-1 mb-2">
              <Picker
                selectedValue={hessianId ?? ''}
                onValueChange={(val) => {
                  setHessianId(val);
                  const found = hessians.find((h) => h.id === val);
                  setHessian(found?.name || '');
                }}
              >
                <Picker.Item label={hessian ? hessian : 'Select Hessian'} value={hessianId ?? ''} />
                {hessians.map((h) => (
                  <Picker.Item key={h.id} label={`${h.name} (${h.hessian_id})`} value={h.id} />
                ))}
              </Picker>
            </View>
            {/* Location dropdown */}
            <View className="border border-gray-300 rounded-lg px-2 py-1 mb-3">
              <Picker
                selectedValue={locationId ?? ''}
                onValueChange={(val) => {
                  setLocationId(val);
                  const found = locations.find((l) => l.id === val);
                  setLocation(found?.name || '');
                }}
              >
                <Picker.Item label={location ? location : 'Select Location'} value={locationId ?? ''} />
                {locations.map((loc) => (
                  <Picker.Item key={loc.id} label={loc.name} value={loc.id} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity 
              className="bg-green-600 rounded-lg py-4 items-center mt-2" 
              onPress={handleNavigateToAddBale}
            >
              <Text className="text-white text-lg font-bold">Add New Bale</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      {/* Dropdown replaces modal; no modal needed */}
    </KeyboardAvoidingView>
  );
}
