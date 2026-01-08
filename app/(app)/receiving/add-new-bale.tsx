import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { powersync, setupPowerSync } from '@/powersync/system';
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

const getTodaySaleDate = (): string => {
  const today = new Date().toISOString();
  return today.includes('T') ? today.split('T')[0] : today;
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
  const [hessians, setHessians] = useState<{ id: number; name: string; hessian_id: string }[]>([]);
  const [editingBaleId, setEditingBaleId] = useState<string | null>(null); // Track if we're editing an existing bale
  const [syncStatus, setSyncStatus] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const toInt = (val: string) => {
    const n = parseInt((val || '').trim(), 10);
    return isNaN(n) ? null : n;
  };

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Reusable function to check booking status
  const checkBookingStatus = async (note: GrowerDeliveryNoteRecord): Promise<boolean> => {
    // First check if has_been_booked is set on the delivery note itself
    if (note.has_been_booked === 1) {
      console.log(`📋 Booking found on delivery note field - has_been_booked: ${note.has_been_booked}`);
      return true;
    }
    
    if (!note.id) {
      return false;
    }

    let bookingFound = false;
    const saleDateKey = getTodaySaleDate();
    
    // Check by grower_delivery_note_id (most specific)
    try {
      console.log(`📋 Checking booking for delivery note ID: ${note.id}, document: ${note.document_number}`);
      const booking = await powersync.get<any>(
        `SELECT has_been_booked, state 
         FROM receiving_grower_bookings 
         WHERE grower_delivery_note_id = ? 
           AND state = 'closed' 
           AND has_been_booked = 1 
         LIMIT 1`,
        [note.id]
      );
      console.log(`📋 Booking query result (by delivery note ID):`, booking);
      if (booking?.has_been_booked === 1 && booking?.state === 'closed') {
        bookingFound = true;
        console.log(`📋 Booking found by delivery note ID - has_been_booked: ${booking.has_been_booked}, state: ${booking.state}`);
      }
    } catch (e: any) { 
      // PowerSync's get() throws "Result set is empty" when no record found - this is expected
      if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
        console.log(`📋 No closed booking with has_been_booked=1 found for delivery note ID: ${note.id}`);
      } else {
        console.warn(`📋 Error checking booking for delivery note ID ${note.id}:`, e);
      }
    }
    
    // If not found by delivery note ID, try by grower_number + sale_date (today) (fallback)
    if (!bookingFound && note.grower_number) {
      try {
        console.log(
          `📋 Checking booking by grower_number: ${note.grower_number} and sale_date: ${saleDateKey}`
        );
        const bookingByGrower = await powersync.get<any>(
          `SELECT has_been_booked, state 
           FROM receiving_grower_bookings 
           WHERE grower_number = ? 
             AND sale_date = ?
             AND has_been_booked = 1 
           LIMIT 1`,
          [note.grower_number, saleDateKey]
        );
        console.log(`📋 Booking query result (by grower_number):`, bookingByGrower);
        if (bookingByGrower?.has_been_booked === 1) {
          bookingFound = true;
          console.log(`📋 Booking found by grower_number - has_been_booked: ${bookingByGrower.has_been_booked}, state: ${bookingByGrower.state}`);
        }
      } catch (e: any) {
        if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
          console.log(
            `📋 No booking with has_been_booked=1 found for grower_number: ${note.grower_number} on sale_date: ${saleDateKey}`
          );
        } else {
          console.warn(`📋 Error checking booking for grower_number ${note.grower_number}:`, e);
        }
      }
    }

    // Persist booking flag locally so future mounts can skip redundant checks
    if (bookingFound && note.id && note.has_been_booked !== 1) {
      try {
        await powersync.execute(
          'UPDATE receiving_grower_delivery_note SET has_been_booked = 1, write_date = ? WHERE id = ?',
          [new Date().toISOString(), note.id]
        );
      } catch (persistError) {
        console.warn('⚠️ Failed to persist booking flag locally:', persistError);
      }
    }

    return bookingFound;
  };

  // Fetch note + metadata once (or when doc changes)
  useEffect(() => {
    if (typeof documentNumber !== 'string') return;

    let cancelled = false;

    const loadNote = async () => {
      try {
        const note = await powersync.get<GrowerDeliveryNoteRecord>(
          'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
          [documentNumber]
        );

        if (cancelled || !note) {
          setGrowerNote(null);
          setExpectedCount(0);
          setIsBooked(false);
          return;
        }

        // Set grower note and expected count
        setGrowerNote(note);
        const expected = note.number_of_bales_delivered || 0;
        setExpectedCount(expected);

        // Get current bale count
        const baleCountResult = await powersync.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
          [note.id, note.document_number]
        );
        const scanned = baleCountResult?.count || 0;
        setScannedCount(scanned);
          
        // Check booking status (only on initial load)
        const bookingFound = await checkBookingStatus(note);
        if (!cancelled) {
          setIsBooked(bookingFound);
        }
      } catch (error: any) {
        if (!cancelled) {
          if (!String(error).includes('Result set is empty')) {
            console.warn(`[Initial Load] Error updating data for ${documentNumber}`, error);
          }
          setGrowerNote(null);
          setScannedCount(0);
          setExpectedCount(0);
          setIsBooked(false);
        }
      }
    };

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [documentNumber]);

  // Watcher dedicated to counts/progress so the UI updates instantly without re-fetching everything
  useEffect(() => {
    if (typeof documentNumber !== 'string') return;

    let cancelled = false;

    const updateCountsOnly = async () => {
      if (!growerNote?.id) return;
      try {
        const baleCountResult = await powersync.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
          [growerNote.id, documentNumber]
        );
        if (!cancelled) {
          setScannedCount(baleCountResult?.count || 0);
        }
      } catch (error) {
        if (!String(error).includes('empty')) {
          console.warn(`[Count Watcher] Error for ${documentNumber}`, error);
        }
      }
    };

    updateCountsOnly();

    const watcher = powersync.watch(
      `SELECT id FROM receiving_bale WHERE document_number = '${documentNumber}'`,
      [],
      {
        onResult: () => updateCountsOnly(),
        onError: (error) => console.error(`[Count Watcher] Error for ${documentNumber}:`, error),
      }
    );

    return () => {
      cancelled = true;
    };
  }, [documentNumber, growerNote?.id]);

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

  // Check if bale exists when barcode is set (from scan or manual entry)
  useEffect(() => {
    const checkExistingBale = async () => {
      if (!scaleBarcode || !growerNote || scaleBarcode.length < 4) {
        setEditingBaleId(null);
        return;
      }

      try {
        // Check if bale exists in the current delivery note
        const existingBale = await powersync.get<any>(
          `SELECT id, scale_barcode, barcode, lot_number, group_number, state 
           FROM receiving_bale 
           WHERE (grower_delivery_note_id = ? OR document_number = ?) 
             AND (scale_barcode = ? OR barcode = ?)
           LIMIT 1`,
          [growerNote.id, growerNote.document_number, scaleBarcode, scaleBarcode]
        );

        if (existingBale) {
          // Bale exists - populate form and set edit mode
          console.log('📦 Existing bale found, entering edit mode:', existingBale);
          setEditingBaleId(existingBale.id);
          setLotNumber(existingBale.lot_number || '');
          setGroupNumber(existingBale.group_number?.toString() || '');
          
          // If bale is not in 'open' state, show warning but allow viewing
          if (existingBale.state !== 'open') {
            Alert.alert(
              'Bale Found',
              `Bale ${scaleBarcode} exists but is in '${existingBale.state}' state. Only bales in 'open' state can be edited.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          // Bale doesn't exist - clear edit mode and form fields
          setEditingBaleId(null);
          // Don't clear lot/group if user has already entered them
          if (!lotNumber && !groupNumber) {
            setLotNumber('');
            setGroupNumber('');
          }
        }
      } catch (e: any) {
        // If error is "Result set is empty", that's fine - no bale found
        if (!e?.message?.includes('empty') && !e?.message?.includes('Result set')) {
          console.warn('⚠️ Error checking for existing bale:', e);
        }
        setEditingBaleId(null);
      }
    };

    checkExistingBale();
  }, [scaleBarcode, growerNote?.id, growerNote?.document_number]);

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
    if (!scaleBarcode || scaleBarcode.length < 4) {
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
    // Skip this check if we're editing the same bale
    if (growerNote && lotNumber.trim() && groupNumber.trim() && !editingBaleId) {
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
    
    // Pre-validation 7: If editing, check that bale is in 'open' state
    if (editingBaleId) {
      try {
        const existingBale = await powersync.get<any>(
          'SELECT state FROM receiving_bale WHERE id = ? LIMIT 1',
          [editingBaleId]
        );
        
        if (existingBale && existingBale.state !== 'open') {
          errors.push(`Cannot edit bale: Bale is in '${existingBale.state}' state. Only bales in 'open' state can be edited.`);
        }
      } catch (e: any) {
        if (!e?.message?.includes('empty') && !e?.message?.includes('Result set')) {
          console.warn('⚠️ Error checking bale state:', e);
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

      // Pre-validation: Check if bale is already associated with a closed document (only for new bales)
      if (!editingBaleId) {
      try {
        const existingBale = await powersync.get<any>(
          `SELECT b.id, b.document_number, b.grower_delivery_note_id, gdn.state as gdn_state, gdn.grower_number, gdn.grower_name, gdn.document_number as gdn_document_number
           FROM receiving_bale b
           LEFT JOIN receiving_grower_delivery_note gdn ON b.grower_delivery_note_id = gdn.id
             WHERE (b.barcode = ? OR b.scale_barcode = ?) AND b.id != ?
           LIMIT 1`,
            [scaleBarcode, scaleBarcode, editingBaleId || '']
        );
        
        if (existingBale) {
          // Use document_number from the bale record, or fall back to the GDN document_number
          const existingDocNum = existingBale.document_number || existingBale.gdn_document_number || 'Unknown';
          const existingState = (existingBale.gdn_state || '').toLowerCase();
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
              // This should not happen if editingBaleId is set correctly, but handle it anyway
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
                { text: 'OK', style: 'cancel', onPress: () => setIsLoading(false) },
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
      }

      // Insert or update the bale
      await saveBale();

      async function saveBale() {
        if (!growerNote) {
          Alert.alert('Error', 'No delivery note found');
          setIsLoading(false);
          return;
        }
        
        const now = new Date().toISOString();

        if (editingBaleId) {
          // Update existing bale
          const updateVals: any = {
            lot_number: lotNumber.trim(),
            group_number: toInt(groupNumber),
            write_date: now
          };

          // Only update hessian and location if they're provided
          if (hessianIdInt !== null) {
            updateVals.hessian = hessianIdInt;
          }
          if (locationIdInt !== null) {
            updateVals.location_id = locationIdInt;
          }

          await powersync.execute(
            `UPDATE receiving_bale SET ${Object.keys(updateVals).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(updateVals), editingBaleId]
          );
          
          console.log(`✅ Bale updated successfully!`);
          
          Alert.alert(
            '✅ Success!',
            `Bale ${scaleBarcode} updated successfully!`,
            [{ text: 'OK' }]
          );
        } else {
          // Insert new bale
          const baleId = uuidv4();

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
        
        // The watcher will automatically update the counts
        console.log(`✅ Bale saved successfully!`);
        }

        // Clear form for next entry
        setScaleBarcode('');
        setLotNumber('');
        setGroupNumber('');
        setEditingBaleId(null);

        // Only auto-advance for new bales, not edits
        if (!editingBaleId) {
        // Check if all bales have been scanned (optimistic check)
        if (scannedCount + 1 >= expectedCount) {
        // Show rainbow success message
        setTimeout(async () => {
          // Re-check booking status when user clicks OK after all bales are scanned
          if (growerNote) {
            const bookingFound = await checkBookingStatus(growerNote);
            setIsBooked(bookingFound);
          }
          
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
          console.log(`Bale saved. Progress: ${scannedCount + 1}/${expectedCount}`);
          
          // Automatically open camera scanner for next bale
          setTimeout(() => {
            handleScanBarcode();
          }, 300); // Small delay to ensure state updates complete
          }
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
    console.log(`📋 [Close] Checking booking status for delivery note: ${growerNote.document_number}`);
    const hasBeenBooked = await checkBookingStatus(growerNote);
    
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

  // Listen for PowerSync connection status and ensure connection
  useEffect(() => {
    (async () => {
      try {
        await setupPowerSync();
      } catch (e) {
        console.warn('⚠️ Failed to setup PowerSync in add-new-bale:', e);
      }
      powersync.registerListener({
        statusChanged: (status: any) => {
          setSyncStatus(!!status.connected);
        },
      });
    })();
  }, []);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className="flex-1 bg-[#65435C]"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen
        options={{ 
          title: 'Add New Bale', 
          headerShown: false 
        }} 
      />
      <View className="flex-1">
        {/* Custom header with back and PowerSync status */}
        <View className="flex-row items-center justify-between mb-2 bg-white  py-5 px-4">
          <TouchableOpacity
            className="flex-row items-center"
            // Navigate back to Add Bale to GD Note explicitly instead of just popping the stack
            onPress={() =>
              router.replace({
                pathname: '/receiving/add-bale-to-gd-note',
                params: {
                  documentNumber: (documentNumber as string) || '',
                  // Preserve any other important context if needed later
                },
              })
            }
          >
            <ChevronLeft size={24} color="#65435C" />
            <Text className="text-[#65435C] font-bold text-lg ml-2">
              Add New Bale
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center">
            <View
              className={`h-2 w-2 rounded-full mr-1 ${
                syncStatus ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <Text
              className={`text-xs font-semibold ${
                syncStatus ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {syncStatus ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      
        <View className="flex-1 px-2">
        <ScrollView
          className="flex-1 bg-white rounded-2xl p-5 mt-2"
          keyboardShouldPersistTaps="handled"
            contentContainerStyle={isKeyboardVisible ? {
              paddingBottom: 400,
              flexGrow: 1
            } : {
              paddingBottom: 40,
              flexGrow: 1
            }}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
        >
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
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
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
          placeholderTextColor="#9CA3AF"
          style={{ color: '#111827' }}
          value={groupNumber}
          onChangeText={setGroupNumber}
          keyboardType="numeric"
          editable={scannedCount < expectedCount}
        />


        {/* Lot Number Input */}
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-4"
          placeholder="Lot Number"
          placeholderTextColor="#9CA3AF"
          style={{ color: '#111827' }}
          value={lotNumber}
          onChangeText={setLotNumber}
          keyboardType="numeric"
          editable={scannedCount < expectedCount}
        />

        {/* Hessian dropdown */}
        <View className="border border-gray-300 rounded-lg px-2 py-1 mb-4">
          <Picker
            selectedValue={sessionHessianId ?? ''}
            onValueChange={(val) => {
              setSessionHessianId(val);
              const found = hessians.find((h) => h.id === val);
              setSessionHessianName(found?.name || '');
            }}
            enabled={scannedCount < expectedCount}
            Style={{ height: 50, color: sessionHessianId ? '#111827' : '#4B5563' }}
          >
            <Picker.Item label={sessionHessianName || 'Select Hessian'} value={sessionHessianId ?? ''} color="#9CA3AF" />
            {hessians.map((h) => (
              <Picker.Item key={h.id} label={`${h.name} (${h.hessian_id})`} value={h.id} color="#374151" />
            ))}
          </Picker>
        </View>

       
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
                {scannedCount >= expectedCount 
                  ? 'All Bales Scanned' 
                  : editingBaleId 
                    ? 'Edit Bale' 
                    : 'Add Bale'}
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
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}