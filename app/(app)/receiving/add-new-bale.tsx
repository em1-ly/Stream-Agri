import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord } from '@/powersync/Schema';
import * as SecureStore from 'expo-secure-store';

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

  const validateBaleEntry = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const errors: string[] = [];
    
    if (!scaleBarcode.trim() || !validateCheckDigit(scaleBarcode)) {
      errors.push('Please enter a valid 10-character bale barcode');
    }
    if (!lotNumber.trim()) {
      errors.push('Please enter a Lot Number');
    }
    if (!groupNumber.trim()) {
      errors.push('Please enter a Group Number');
    } else if (toInt(groupNumber) === null) {
      errors.push('Please enter an integer for group number');
    }
    
    // Check if all bales have been scanned
    if (scannedCount >= expectedCount) {
      errors.push(`All ${expectedCount} bales have already been scanned!`);
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
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      const base = (url: string | null) => !url ? '' : (url.startsWith('http') ? url : `https://${url}`);
      
      console.log('💾 Saving bale:', {
        document_number: growerNote.document_number,
        barcode: scaleBarcode,
        lot_number: lotNumber,
        group_number: groupNumber,
        hessian_id: hessianIdInt,
        location_id: locationIdInt
      });

      const response = await fetch(`${base(serverURL)}/api/fo/add-bale`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-FO-Token': token || '' 
        },
        body: JSON.stringify({
          params: {
            document_number: growerNote.document_number,
            barcode: scaleBarcode,
            lot_number: lotNumber,
            group_number: groupNumber,
            hessian_id: hessianIdInt,
            location_id: locationIdInt
          }
        })
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      
      const result = await response.json();
      const responseData = result.result || result;

      if (!responseData.success) {
        throw new Error(responseData.message || responseData.error || 'Failed to add bale');
      }
      
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

    setIsClosingDelivery(true);
    try {
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      
      if (!serverURL || !token) {
        Alert.alert('Error', 'Missing server configuration');
        return;
      }

      const base = (url: string | null) => !url ? '' : (url.startsWith('http') ? url : `https://${url}`);
      
      console.log('🔒 Closing delivery note:', growerNote.document_number);

      const response = await fetch(`${base(serverURL)}/api/fo/receiving/close_delivery_note`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-FO-Token': token 
        },
        body: JSON.stringify({
          params: {
            document_number: growerNote.document_number
          }
        })
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      
      const result = await response.json();
      const responseData = result.result || result;

      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to close delivery note');
      }
      
      console.log('✅ Delivery note closed successfully:', responseData.message);
      
      // Navigate immediately back to the GD Note screen
      router.replace('/(app)/receiving/add-bale-to-gd-note');
      
      // Show acknowledgement only
      Alert.alert(
        '✅ Success!', 
        `Delivery note ${growerNote.document_number} has been closed successfully!`,
        [
          { text: 'OK' }
        ]
      );

    } catch (error: any) {
      Alert.alert('Error', `Failed to close delivery note: ${error.message || 'Unknown error'}`);
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

        {/* Lot Number Input */}
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-4"
          placeholder="Lot Number"
          value={lotNumber}
          onChangeText={setLotNumber}
          keyboardType="numeric"
          editable={scannedCount < expectedCount}
        />

        {/* Group Number Input */}
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-6"
          placeholder="Group Number"
          value={groupNumber}
          onChangeText={setGroupNumber}
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
              isClosingDelivery ? 'opacity-50' : ''
            }`}
            onPress={handleCloseDeliveryNote}
            disabled={isClosingDelivery}
          >
            {isClosingDelivery ? (
              <ActivityIndicator color="#65435C" size="small" />
            ) : (
              <Text className="text-[#65435C] font-semibold text-lg">Close Delivery Note</Text>
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