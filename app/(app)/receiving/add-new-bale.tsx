import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord } from '@/powersync/Schema';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

// Code 39 check digit validation
const validateCheckDigit = (barcode: string): boolean => {
  console.log('🔍 Validating barcode as Code 39:', barcode);

  if (!barcode || barcode.length !== 10) {
    console.log('❌ Barcode is not 10 characters long for Code 39 validation');
    return false;
  }

  const code39Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+% ";
  const data = barcode.slice(0, -1);
  const checkChar = barcode.slice(-1);

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const value = code39Chars.indexOf(char.toUpperCase());
    
    if (value === -1) {
      console.log(`❌ Invalid Code 39 character found: ${char}`);
      return false;
    } 
    
    sum += value;
  }
  
  const checkDigitIndex = sum % 43;
  const calculatedCheckChar = code39Chars[checkDigitIndex];
  
  const isValid = calculatedCheckChar === checkChar;
  console.log(`🔍 Code 39 validation: Data=${data}, Check=${checkChar}, Calculated=${calculatedCheckChar}, Valid=${isValid}`);
    
  return isValid;
};

export default function AddNewBaleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { documentNumber, hessianId, locationId, hessianName, locationName } = params;

  const [growerNote, setGrowerNote] = useState<GrowerDeliveryNoteRecord | null>(null);
  // Preserve hessian/location across scans and re-renders
  const [sessionHessianId, setSessionHessianId] = useState<any>(hessianId);
  const [sessionLocationId, setSessionLocationId] = useState<any>(locationId);
  const [sessionHessianName, setSessionHessianName] = useState<string>(typeof hessianName === 'string' ? hessianName : '');
  const [sessionLocationName, setSessionLocationName] = useState<string>(typeof locationName === 'string' ? locationName : '');
  const [scaleBarcode, setScaleBarcode] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [scannedCount, setScannedCount] = useState(0);
  const [expectedCount, setExpectedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingDelivery, setIsClosingDelivery] = useState(false);
  const [isBooked, setIsBooked] = useState(false); // Track booking status from grower_bookings model
  const lastProcessedBaleBarcode = useRef<string>('');

  const toInt = (val: string) => {
    const n = parseInt((val || '').trim(), 10);
    return isNaN(n) ? null : n;
  };

  // Fetch GD Note and current bale count
  const fetchGrowerNote = useCallback(async () => {
    if (typeof documentNumber === 'string') {
      try {
        const result = await powersync.get<GrowerDeliveryNoteRecord>(
          'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
          [documentNumber]
        );
        if (result) {
          // Get current bale count
          const baleCount = await powersync.get<{ count: number }>(
            'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
            [result.id, result.document_number]
          );
          const currentCount = baleCount?.count || 0;
          const expected = result.number_of_bales_delivered || 0;
          
          setScannedCount(currentCount);
          setExpectedCount(expected);
          setGrowerNote(result);
          
          console.log(`📊 Bale counts - Scanned: ${currentCount}, Expected: ${expected}`);
          console.log(`📋 Booking status - has_been_booked: ${result.has_been_booked} (${result.has_been_booked === 1 ? 'BOOKED' : result.has_been_booked === 0 ? 'NOT BOOKED' : 'NULL/NOT SET'})`);
          
          // Check booking status: query receiving_grower_bookings table for has_been_booked = 1 using grower number
          let bookingFound = false;
          
          if (result.grower_number) {
            try {
              // Query receiving_grower_bookings table to check if has_been_booked = 1 for this grower
              const booking = await powersync.get<any>(
                `SELECT has_been_booked FROM receiving_grower_bookings WHERE grower_number = ? AND has_been_booked = 1 LIMIT 1`,
                [result.grower_number]
              );
              
              if (booking && booking.has_been_booked === 1) {
                bookingFound = true;
                setIsBooked(true);
                console.log(`📋 Booking status from receiving_grower_bookings - has_been_booked: ${booking.has_been_booked} (BOOKED) for grower ${result.grower_number}`);
              } else {
                console.log(`📋 No booking with has_been_booked=1 found in receiving_grower_bookings for grower ${result.grower_number}`);
              }
            } catch (bookingError: any) {
              // PowerSync's get() throws "Result set is empty" when no record found - this is expected
              if (bookingError?.message?.includes('empty') || bookingError?.message?.includes('Result set')) {
                // This is normal - no booking record exists or has_been_booked is not 1
                console.log(`📋 No booking with has_been_booked=1 found in receiving_grower_bookings for grower ${result.grower_number}`);
              } else {
                // Actual error occurred
                console.warn('⚠️ Failed to check receiving_grower_bookings:', bookingError);
              }
            }
          } else {
            console.log(`📋 No grower_number found for delivery note ${result.document_number || result.id}, cannot check booking status`);
          }
          
          // If booking not found, set to false
          if (!bookingFound) {
            setIsBooked(false);
          }
        }
      } catch (error) {
      }
    }
  }, [documentNumber]);

  useEffect(() => {
    fetchGrowerNote();
  }, [fetchGrowerNote]);

  // Initialize session state from params once (and keep if params change)
  useEffect(() => {
    if (hessianId !== undefined && hessianId !== null) {
      setSessionHessianId(hessianId);
    }
    if (locationId !== undefined && locationId !== null) {
      setSessionLocationId(locationId);
    }
    if (typeof hessianName === 'string') {
      setSessionHessianName(hessianName);
    }
    if (typeof locationName === 'string') {
      setSessionLocationName(locationName);
    }
  }, [hessianId, locationId]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchGrowerNote();
    }, [fetchGrowerNote])
  );

  // Listen for scanned bale barcode - FIXED: Don't navigate away
  useEffect(() => {
    if (params.scannedBaleBarcode && 
        typeof params.scannedBaleBarcode === 'string' && 
        params.scannedBaleBarcode !== 'undefined' &&
        params.scannedBaleBarcode !== lastProcessedBaleBarcode.current) {
      
      console.log('📦 Processing scanned bale barcode in AddNewBaleScreen:', params.scannedBaleBarcode);
      lastProcessedBaleBarcode.current = params.scannedBaleBarcode;
      setScaleBarcode(params.scannedBaleBarcode);
      
      // Clear the scanned barcode from params to prevent re-triggering on back navigation
      // This is the key fix - we modify the current route params instead of navigating
      if (router.canGoBack()) {
        router.setParams({ scannedBaleBarcode: undefined });
      }
    }
  }, [params.scannedBaleBarcode, router]);

  // Validate lot number format (matches server-side is_valid_lot_number)
  const isValidLotNumber = (lot: string): boolean => {
    if (!lot || !lot.trim()) {
      return false;
    }
    
    const lotStr = lot.trim();
    
    // Check length (max 8 characters)
    if (lotStr.length > 8) {
      return false;
    }
    
    // Check all characters are digits or slash
    for (const char of lotStr) {
      if (!'1234567890/'.includes(char)) {
        return false;
      }
    }
    
    // If contains slash, validate format
    if (lotStr.includes('/')) {
      // Cannot start or end with slash
      if (lotStr[0] === '/' || lotStr[lotStr.length - 1] === '/') {
        return false;
      }
      
      // Must have exactly 2 parts
      const parts = lotStr.split('/');
      if (parts.length !== 2) {
        return false;
      }
      
      // Second part cannot be '0'
      if (parts[1] === '0') {
        return false;
      }
    }
    
    return true;
  };

  const validateBaleEntry = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const errors: string[] = [];
    
    // Pre-validation 1: Barcode validation
    if (!scaleBarcode || scaleBarcode.trim().length < 4) {
      errors.push('Please check barcode (must be at least 4 characters)');
    } else if (!validateCheckDigit(scaleBarcode)) {
      errors.push('Please enter a valid 10-character bale barcode');
    }
    
    // Pre-validation 2: Lot number validation
    if (!lotNumber.trim()) {
      errors.push('Please enter a Lot Number');
    } else if (!isValidLotNumber(lotNumber)) {
      errors.push('Please enter a valid lot number. It should be either a number or 2 numbers, separated by a slash, with no space');
    }
    
    // Pre-validation 3: Group number validation
    if (!groupNumber.trim()) {
      errors.push('Please enter a Group Number');
    } else {
      const groupNum = toInt(groupNumber);
      if (groupNum === null) {
        errors.push('Please enter an integer for group number');
      } else if (groupNum < 1) {
        errors.push('Group number must be greater than zero');
      }
    }
    
    // Pre-validation 4: Check delivery note state (must be 'open')
    if (growerNote) {
      const currentState = (growerNote.state || '').toLowerCase();
      if (currentState !== 'open') {
        errors.push(`Cannot add bale: Delivery note ${growerNote.document_number} is not in 'open' state (current state: ${currentState})`);
      }
    }
    
    // Pre-validation 5: Check if cannot exceed expected bales
    if (scannedCount >= expectedCount) {
      errors.push(`Cannot add more bales: Already captured ${scannedCount} out of ${expectedCount} expected bales`);
    }
    
    // Pre-validation 6: Check for duplicate group+lot combination in same delivery note
    if (growerNote && lotNumber.trim() && groupNumber.trim()) {
      const groupNum = toInt(groupNumber);
      if (groupNum !== null && isValidLotNumber(lotNumber)) {
        try {
          const duplicateBale = await powersync.get<any>(
            `SELECT id, lot_number, group_number 
             FROM receiving_bale 
             WHERE (grower_delivery_note_id = ? OR document_number = ?) 
               AND lot_number = ? 
               AND group_number = ? 
             LIMIT 1`,
            [growerNote.id, growerNote.document_number, lotNumber.trim(), groupNum]
          );
          
          if (duplicateBale) {
            errors.push(`Group ${groupNumber} and Lot ${lotNumber} is already in this delivery note`);
          }
        } catch (e: any) {
          // If error is "Result set is empty", that's fine - no duplicate
          if (!e?.message?.includes('empty') && !e?.message?.includes('Result set')) {
            console.warn('⚠️ Error checking for duplicate group/lot:', e);
            // Continue - server will validate
          }
        }
      }
    }
    
    return errors.length ? { ok: false, error: errors.join('\n') } : { ok: true };
  };

  const handleSaveBale = async () => {
    if (!growerNote) {
      Alert.alert('Error', 'No delivery note found');
      return;
    }

    const validation = await validateBaleEntry();
    if (!validation.ok) {
      Alert.alert('Validation Error', validation.error);
      return;
    }

    setIsLoading(true);
    try {
      // Ensure IDs are integers for backend
      const normalizeId = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      };
      const hessianIdInt = normalizeId(sessionHessianId);
      const locationIdInt = normalizeId(sessionLocationId);
      if (hessianIdInt === null) {
        Alert.alert('Validation Error', 'Please select a Hessian');
        return;
      }
      if (locationIdInt === null) {
        Alert.alert('Validation Error', 'Please select a Location');
        return;
      }
      
      console.log('💾 Saving bale:', {
        document_number: growerNote.document_number,
        barcode: scaleBarcode,
        lot_number: lotNumber,
        group_number: groupNumber,
        hessian_id: hessianIdInt,
        location_id: locationIdInt
      });

      // Pre-validation: Check if bale is already associated with a closed document
      try {
        const existingBale = await powersync.get<any>(
          `SELECT b.id, b.document_number, b.grower_delivery_note_id, gdn.state, gdn.grower_number, gdn.grower_name, gdn.document_number as gdn_document_number
           FROM receiving_bale b
           LEFT JOIN receiving_grower_delivery_note gdn ON b.grower_delivery_note_id = gdn.id
           WHERE b.barcode = ? OR b.scale_barcode = ?
           LIMIT 1`,
          [scaleBarcode, scaleBarcode]
        );
        
        if (existingBale) {
          // Use document_number from the bale record, or fall back to the GDN document_number
          const existingDocNum = existingBale.document_number || existingBale.gdn_document_number || 'Unknown';
          const existingState = (existingBale.state || '').toLowerCase();
          const existingGrowerNum = existingBale.grower_number || 'Unknown';
          const existingGrowerName = existingBale.grower_name || 'Unknown';
          
          console.log('🔍 Existing bale found:', {
            bale_document_number: existingBale.document_number,
            gdn_document_number: existingBale.gdn_document_number,
            final_document_number: existingDocNum,
            state: existingState,
            grower_number: existingGrowerNum
          });
          
          // Check if the existing bale is associated with a closed document
          const closedStates = ['checked', 'closed', 'laid', 'completed'];
          if (closedStates.includes(existingState)) {
            Alert.alert(
              'Bale Already Associated',
              `Bale ${scaleBarcode} is already associated with a Closed Document # ${existingDocNum} for Grower ${existingGrowerNum}${existingGrowerName !== 'Unknown' ? ` (${existingGrowerName})` : ''}.\n\nCannot add this bale to another delivery note.`,
              [{ text: 'OK' }]
            );
            setIsLoading(false);
            return;
          }
          
          // If bale exists but document is not closed, check if it's the same document
          if (existingBale.grower_delivery_note_id === growerNote.id) {
            Alert.alert(
              'Bale Already Added',
              `Bale ${scaleBarcode} has already been added to this delivery note (${existingDocNum}).`,
              [{ text: 'OK' }]
            );
            setIsLoading(false);
            return;
          }
          
          // If bale exists in a different open document, warn the user
          Alert.alert(
            'Bale Already Associated',
            `Bale ${scaleBarcode} is already associated with Document # ${existingDocNum} (State: ${existingState}).`,
            [
              { text: '0k', style: 'cancel', onPress: () => setIsLoading(false) },
              
            ]
          );
          return;
        }
      } catch (baleCheckError: any) {
        // If error is "Result set is empty", that's fine - bale doesn't exist
        if (!baleCheckError?.message?.includes('empty') && !baleCheckError?.message?.includes('Result set')) {
          console.warn('⚠️ Error checking for existing bale:', baleCheckError);
          // Continue anyway - let server handle validation
        }
      }

      // Insert the bale
      await insertBale();

      async function insertBale() {
        if (!growerNote) {
          Alert.alert('Error', 'No delivery note found');
          setIsLoading(false);
          return;
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
          hessian: hessianIdInt, // Column name is 'hessian', not 'hessian_id'
          location_id: locationIdInt,
          create_date: now,
          write_date: now,
          mass: 0, 
          state: 'open'
        };

        await powersync.execute(
          'INSERT INTO receiving_bale (id, grower_delivery_note_id, document_number, scale_barcode, barcode, lot_number, group_number, hessian, location_id, create_date, write_date, mass, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            baleData.id,
            baleData.grower_delivery_note_id,
            baleData.document_number,
            baleData.scale_barcode,
            baleData.barcode,
            baleData.lot_number,
            baleData.group_number,
            baleData.hessian,
            baleData.location_id,
            baleData.create_date,
            baleData.write_date,
            baleData.mass,
            baleData.state
          ]
        );
        
        // Success - update counts
        const newCount = scannedCount + 1;
        setScannedCount(newCount);
        
        console.log(`✅ Bale saved successfully! New count: ${newCount}/${expectedCount}`);

        // Clear form for next entry
        setScaleBarcode('');
        setLotNumber('');
        setGroupNumber('');

        // Refresh data to get latest count from server
        await powersync.execute('SELECT 1');
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for sync
        await fetchGrowerNote();

        // Check if all bales have been scanned
        if (newCount >= expectedCount) {
        // Show rainbow success message
        setTimeout(() => {
          Alert.alert(
            '🌈 Success!', 
            `Successfully Scanned!\n\nAll ${expectedCount} bales have been successfully scanned!`,
            [
              {
                text: 'OK', 
                onPress: () => {
                  // Navigate back to the GD Note screen (first screen)
                  console.log('🎯 Navigating back to GD Note screen');
                }
              }
            ]
          );
        }, 1000);
        } else {
          // Do not show per-bale success alerts; remain silent until completion
          console.log(`Bale saved. Progress: ${newCount}/${expectedCount}`);
        }
        
        setIsLoading(false);
      }

    } catch (error: any) {
      Alert.alert('Error', `Failed to save bale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBarcode = () => {
    router.push({
      pathname: '/receiving/barcode-scanner',
      params: { 
        scanType: 'bale',
        returnTo: '/receiving/add-new-bale',
        documentNumber: documentNumber,
        hessianId: sessionHessianId,
        locationId: sessionLocationId,
        preserveState: 'true'
      }
    });
  };

  const handleCloseDeliveryNote = async () => {
    if (!growerNote) {
      Alert.alert('Error', 'No delivery note found');
      return;
    }

    // ===== ALL VALIDATIONS ARE LOCAL - NO SERVER CALLS =====
    
    // Local validation 1: Check if delivery note exists
    if (!growerNote.id) {
      Alert.alert('Error', 'Delivery note ID is missing. Cannot close.');
      return;
    }

    // Local validation 2: Check if already closed
    const currentState = (growerNote.state || '').toLowerCase();
    if (currentState === 'checked' || currentState === 'laid' || currentState === 'closed' || currentState === 'completed') {
      Alert.alert('Already Closed', `Delivery note ${growerNote.document_number} is already closed (state: ${currentState}).`);
      return;
    }

    // Local validation 3: Check if in a valid state to close
    if (currentState && !['open', 'printing', 'laying'].includes(currentState)) {
      Alert.alert('Cannot Close', `Delivery note ${growerNote.document_number} cannot be closed from state: ${currentState}.`);
      return;
    }

    // Local validation 4: Check if delivery note has been booked
    // Query receiving_grower_bookings table to check if has_been_booked = 1 using grower number
    let hasBeenBooked = false;
    
    if (growerNote.grower_number) {
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

    // Local validation 5: Validate that all expected bales are scanned
    const expectedBales = growerNote.number_of_bales_delivered || 0;
    if (expectedBales < 0) {
      Alert.alert('Data Error', 'Expected bales count is invalid. Please contact support.');
      return;
    }

    // Get current bale count from local database
    let actualBales = 0;
    try {
      const baleCount = await powersync.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
        [growerNote.id, growerNote.document_number]
      );
      actualBales = baleCount?.count || 0;
    } catch (e) {
      console.error('Failed to count bales locally', e);
      Alert.alert('Error', 'Failed to count scanned bales. Please try again.');
      return;
    }

    // Local validation 6: Check if all bales are scanned
    if (actualBales < expectedBales) {
      Alert.alert(
        'Cannot Close', 
        `Cannot close delivery note: Only ${actualBales} out of ${expectedBales} expected bales have been scanned.\n\nPlease scan all bales before closing.`
      );
      return;
    }

    // ===== ALL VALIDATIONS PASSED - UPDATE LOCAL DATABASE =====
    // This is a pre-validation: we set the state locally, and PowerSync will sync it to server
    // The server will validate again and use proper close method
    
    setIsClosingDelivery(true);
    try {
      const writeDate = new Date().toISOString();
      await powersync.execute(
        'UPDATE receiving_grower_delivery_note SET state = ?, write_date = ? WHERE id = ?',
        ['checked', writeDate, growerNote.id]
      );
      
      console.log('✅ Delivery note closed successfully locally:', growerNote.document_number);
      
      // Update local state
      setGrowerNote({
        ...growerNote,
        state: 'checked',
        write_date: writeDate
      });
      
      // Show success message
      Alert.alert(
        '✅ Success!', 
        `Delivery note ${growerNote.document_number} has been closed successfully!\n\nScanned: ${actualBales}/${expectedBales} bales\n\n`,
        [
          { 
            text: 'OK',
            onPress: () => {
              // Navigate back to the GD Note screen
              router.replace('/(app)/receiving/add-bale-to-gd-note');
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Failed to close delivery note locally', error);
      const errorMessage = error?.message || 'An unknown error occurred while closing the delivery note.';
      Alert.alert('Error', `Failed to close delivery note locally:\n${errorMessage}\n\nPlease try again.`);
    } finally {
      setIsClosingDelivery(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className="flex-1 bg-[#65435C]"
    >
      <Stack.Screen
        name="add-bale-to-gd-note"
        options={{ 
          title: 'Add New Bale', 
          headerShown: true 
        }} 
      />
      
      <ScrollView className="flex-1 bg-white rounded-2xl p-5 m-4">
        {growerNote && (
          <View className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Document: {growerNote.document_number}
            </Text>
            <Text className="text-base text-gray-600 mb-1">
              Grower: {growerNote.grower_number}
            </Text>
          
            <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
              <Text className="text-base font-semibold text-gray-700">Scanning Progress:</Text>
              <Text className="text-base font-bold text-[#65435C]">
                {scannedCount} / {expectedCount}
              </Text>
            </View>
            {scannedCount >= expectedCount && (
              <View className="mt-3 bg-green-50 border border-green-200 rounded-md p-3">
                <Text className="text-green-700 font-semibold text-center">
                  ✅ All bales scanned! Complete the delivery.
                </Text>
              </View>
            )}
          </View>
        )}

        <Text className="text-xl font-bold text-[#65435C] mb-4">Bale Details</Text>
        
        {/* Scale Barcode Input */}
        <View className="flex-row mb-4">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Scale Barcode"
            value={scaleBarcode}
            onChangeText={setScaleBarcode}
            autoCapitalize="characters"
            editable={scannedCount < expectedCount}
          />
          <TouchableOpacity 
            className="bg-[#65435C] rounded-lg p-3 ml-2 justify-center"
            onPress={handleScanBarcode}
            disabled={scannedCount >= expectedCount}
          >
            <Camera color="white" size={20} />
          </TouchableOpacity>
        </View>
         {/* Group Number Input */}
         <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-6"
          placeholder="Group Number"
          value={groupNumber}
          onChangeText={setGroupNumber}
          keyboardType="numeric"
          editable={scannedCount < expectedCount}
        />


        {/* Lot Number Input */}
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-4"
          placeholder="Lot Number"
          value={lotNumber}
          onChangeText={setLotNumber}
          keyboardType="numeric"
          editable={scannedCount < expectedCount}
        />

       
        {/* Action Buttons - Side by Side */}
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity 
            className={`flex-1 rounded-lg py-4 items-center ${
              scannedCount >= expectedCount || isLoading ? 'bg-gray-400' : 'bg-[#65435C]'
            }`}
            onPress={handleSaveBale}
            disabled={scannedCount >= expectedCount || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white text-lg font-bold">
                {scannedCount >= expectedCount ? 'All Bales Scanned' : 'Add Bale'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`flex-1 py-4 items-center border border-[#65435C] rounded-lg ${
              isClosingDelivery || scannedCount < expectedCount || (growerNote?.state || '').toLowerCase() === 'checked' || !isBooked ? 'opacity-50 bg-gray-100' : ''
            }`}
            onPress={handleCloseDeliveryNote}
            disabled={isClosingDelivery || scannedCount < expectedCount || (growerNote?.state || '').toLowerCase() === 'checked' || !isBooked}
          >
            {isClosingDelivery ? (
              <ActivityIndicator color="#65435C" size="small" />
            ) : (
              <Text className={`font-semibold text-lg ${scannedCount < expectedCount || (growerNote?.state || '').toLowerCase() === 'checked' || !isBooked ? 'text-gray-400' : 'text-[#65435C]'}`}>
                {!isBooked
                  ? 'Close (Not Booked)'
                  : scannedCount < expectedCount 
                    ? `Close (${scannedCount}/${expectedCount} bales)` 
                    : (growerNote?.state || '').toLowerCase() === 'checked' 
                      ? 'Already Closed' 
                      : 'Close Delivery Note'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Completion Message */}
        {scannedCount >= expectedCount && expectedCount > 0 && (
          <View className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Text className="text-green-700 text-center font-semibold text-lg">
              🎉 Scanning Complete! 🎉
            </Text>
            <Text className="text-green-600 text-center mt-2">
              All {expectedCount} bales have been successfully scanned!
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}