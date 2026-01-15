import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { BaleRecord, GrowerDeliveryNoteRecord } from '@/powersync/Schema';

type BaleWithId = BaleRecord & { id: string };

const EditBaleScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { baleId, deliveryNoteId } = params;
  const [bale, setBale] = useState<BaleWithId | null>(null);
  const [note, setNote] = useState<GrowerDeliveryNoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaleBarcode, setScaleBarcode] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const lastProcessedScannedBarcode = useRef<string>('');

  useEffect(() => {
    if (typeof baleId !== 'string') return;

    const fetchBaleData = async () => {
      setLoading(true);
      try {
        // Fetch the bale
        const baleResult = await powersync.get<BaleWithId>(
          'SELECT * FROM receiving_bale WHERE id = ?',
          [baleId]
        );

        if (!baleResult) {
          Alert.alert('Error', 'Bale not found', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }

        // Validate bale can be edited (must be in 'open' state)
        if (baleResult.state !== 'open') {
          Alert.alert(
            'Cannot Edit',
            `Cannot edit bale in state '${baleResult.state}'. Only bales in 'open' state can be edited.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        setBale(baleResult);
        // Only set initial values if we haven't received a scanned barcode yet
        // Check both params and the ref to see if we've already processed a scan
        const hasScannedBarcode = (params.scannedBarcode && 
          typeof params.scannedBarcode === 'string' && 
          params.scannedBarcode !== 'undefined') ||
          lastProcessedScannedBarcode.current;
        
        if (!hasScannedBarcode) {
          setScaleBarcode(baleResult.scale_barcode || '');
        } else if (lastProcessedScannedBarcode.current) {
          // If we have a processed barcode, use that instead
          setScaleBarcode(lastProcessedScannedBarcode.current);
        }
        setGroupNumber(baleResult.group_number?.toString() || '');
        setLotNumber(baleResult.lot_number || '');

        // Fetch delivery note if we have the ID
        if (baleResult.grower_delivery_note_id) {
          try {
            const noteResult = await powersync.get<GrowerDeliveryNoteRecord>(
              'SELECT * FROM receiving_grower_delivery_note WHERE id = ?',
              [baleResult.grower_delivery_note_id]
            );
            if (noteResult) {
              setNote(noteResult);
            }
          } catch (e) {
            console.warn('Failed to fetch delivery note:', e);
          }
        } else if (typeof deliveryNoteId === 'string') {
          try {
            const noteResult = await powersync.get<GrowerDeliveryNoteRecord>(
              'SELECT * FROM receiving_grower_delivery_note WHERE id = ?',
              [deliveryNoteId]
            );
            if (noteResult) {
              setNote(noteResult);
            }
          } catch (e) {
            console.warn('Failed to fetch delivery note:', e);
          }
        }
      } catch (error) {
        console.error('Failed to fetch bale:', error);
        Alert.alert('Error', 'Failed to load bale data', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchBaleData();
  }, [baleId, deliveryNoteId]);

  // Listen for scanned barcode from the scanner screen
  // This must run after bale data is loaded to prevent overwriting
  useEffect(() => {
    if (!bale) return; // Wait for bale data to be loaded
    
    if (params.scannedBarcode && 
        typeof params.scannedBarcode === 'string' && 
        params.scannedBarcode !== 'undefined' &&
        params.scannedBarcode !== lastProcessedScannedBarcode.current) {
      
      console.log('📦 Processing scanned barcode in Edit Bale:', params.scannedBarcode);
      lastProcessedScannedBarcode.current = params.scannedBarcode;
      setScaleBarcode(params.scannedBarcode);
      
      // Clear the scanned barcode from params to prevent re-triggering
      router.setParams({ scannedBarcode: undefined });
    }
  }, [params.scannedBarcode, router, bale]);

  // Also listen when screen comes into focus (for when navigating back)
  useFocusEffect(
    useCallback(() => {
      if (!bale) return; // Wait for bale data to be loaded
      
      if (params.scannedBarcode && 
          typeof params.scannedBarcode === 'string' && 
          params.scannedBarcode !== 'undefined' &&
          params.scannedBarcode !== lastProcessedScannedBarcode.current) {
        
        console.log('📦 Processing scanned barcode in Edit Bale (focus):', params.scannedBarcode);
        lastProcessedScannedBarcode.current = params.scannedBarcode;
        setScaleBarcode(params.scannedBarcode);
        
        // Clear the scanned barcode from params to prevent re-triggering
        router.setParams({ scannedBarcode: undefined });
      }
    }, [params.scannedBarcode, router, bale])
  );

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

  const handleScanBarcode = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/receiving/barcode-scanner',
      params: { 
        scanType: 'bale',
        returnTo: 'edit-bale',
        baleId: baleId,
        deliveryNoteId: deliveryNoteId || bale?.grower_delivery_note_id || '',
        preserveState: 'true'
      }
    });
  };

  const handleUpdateBale = async () => {
    Keyboard.dismiss();
    if (!bale) return;

    const errors: string[] = [];

    // Validation 1: Check if anything changed
    const scaleBarcodeChanged = scaleBarcode !== (bale.scale_barcode || '');
    const groupNumberChanged = groupNumber.trim() !== (bale.group_number?.toString() || '');
    const lotNumberChanged = lotNumber.trim() !== (bale.lot_number || '');

    if (!scaleBarcodeChanged && !groupNumberChanged && !lotNumberChanged) {
      Alert.alert('Validation Error', 'No changes detected. Please modify at least one field.');
      return;
    }

    // Validation 2: Lot number format
    if (!isValidLotNumber(lotNumber)) {
      errors.push('Invalid lot number format. It should be either a number or 2 numbers, separated by a slash, with no space.');
    }

    // Validation 3: Group number
    const groupNum = groupNumber.trim() ? parseInt(groupNumber.trim(), 10) : null;
    if (groupNum === null || isNaN(groupNum)) {
      errors.push('Please enter a valid integer for group number.');
    } else if (groupNum < 1) {
      errors.push('Group number must be greater than 0.');
    }

    // Validation 4: Check if scale barcode changed and if new one is unique
    if (scaleBarcodeChanged) {
      try {
        const existingBale = await powersync.get<any>(
          'SELECT id FROM receiving_bale WHERE (scale_barcode = ? OR barcode = ?) AND id != ? LIMIT 1',
          [scaleBarcode, scaleBarcode, bale.id]
        );
        
        if (existingBale) {
          errors.push(`Scale barcode '${scaleBarcode}' is already used by another bale. Please use a unique barcode.`);
        }
      } catch (e: any) {
        // If error is "Result set is empty", that's fine - no duplicate
        if (!e?.message?.includes('empty') && !e?.message?.includes('Result set')) {
          console.warn('⚠️ Error checking for duplicate scale barcode:', e);
        }
      }
    }

    // Validation 5: Check for duplicate group/lot combination in same delivery note
    if ((groupNumberChanged || lotNumberChanged) && note) {
      const groupNum = groupNumber.trim() ? parseInt(groupNumber.trim(), 10) : null;
      if (groupNum !== null && isValidLotNumber(lotNumber)) {
        try {
          const duplicateBale = await powersync.get<any>(
            `SELECT id FROM receiving_bale 
             WHERE (grower_delivery_note_id = ? OR document_number = ?) 
               AND group_number = ? 
               AND lot_number = ? 
               AND id != ? 
             LIMIT 1`,
            [note.id, note.document_number, groupNum, lotNumber.trim(), bale.id]
          );
          
          if (duplicateBale) {
            errors.push(`Group ${groupNumber.trim()} and Lot ${lotNumber.trim()} combination already exists in this delivery note. Please use a unique combination.`);
          }
        } catch (e: any) {
          // If error is "Result set is empty", that's fine - no duplicate
          if (!e?.message?.includes('empty') && !e?.message?.includes('Result set')) {
            console.warn('⚠️ Error checking for duplicate group/lot:', e);
          }
        }
      }
    }

    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    setIsUpdating(true);
    try {
      const updateVals: any = {};
      const changes: string[] = [];

      if (scaleBarcodeChanged) {
        updateVals.scale_barcode = scaleBarcode;
        updateVals.barcode = scaleBarcode; // Also update barcode field
        changes.push(`Scale Barcode: ${bale.scale_barcode || 'N/A'} → ${scaleBarcode}`);
      }

      if (groupNumberChanged && groupNum !== null) {
        updateVals.group_number = groupNum;
        changes.push(`Group Number: ${bale.group_number || 'N/A'} → ${groupNum}`);
      }

      if (lotNumberChanged) {
        updateVals.lot_number = lotNumber.trim();
        changes.push(`Lot Number: ${bale.lot_number || 'N/A'} → ${lotNumber.trim()}`);
      }

      // Update write_date
      updateVals.write_date = new Date().toISOString();

      // Update the bale in local database
      await powersync.execute(
        `UPDATE receiving_bale SET ${Object.keys(updateVals).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...Object.values(updateVals), bale.id]
      );

      Alert.alert(
        '✅ Success!',
        `Bale updated successfully!\n\nChanges:\n${changes.join('\n')}`,
        [{ 
          text: 'OK', 
          onPress: () => {
            // Navigate back to the detail screen, not just back (which might go to scanner)
            const noteId = (deliveryNoteId && typeof deliveryNoteId === 'string') 
              ? deliveryNoteId 
              : bale.grower_delivery_note_id;
            
            if (noteId) {
              router.replace({
                pathname: '/receiving/[id]' as any,
                params: { id: noteId }
              });
            } else {
              router.back();
            }
          }
        }]
      );
    } catch (error: any) {
      console.error('Failed to update bale:', error);
      Alert.alert('Error', `Failed to update bale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="mt-4 text-lg text-gray-600">Loading Bale...</Text>
      </View>
    );
  }

  if (!bale) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Bale Not Found' }} />
        <Text className="text-2xl font-bold text-red-600">Error</Text>
        <Text className="mt-2 text-lg text-gray-700 text-center">
          Could not find the bale. It might have been deleted or there was a sync error.
        </Text>
        <TouchableOpacity
          className="mt-4 bg-[#65435C] px-6 py-3 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <Stack.Screen options={{ title: 'Edit Bale', headerShown: true }} />
      
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-4">
          {/* Bale Info Card */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Bale Information</Text>
            <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
              <Text className="font-semibold text-gray-600">Current Scale Barcode:</Text>
              <Text className="text-gray-800">{bale.scale_barcode || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
              <Text className="font-semibold text-gray-600">Current Group:</Text>
              <Text className="text-gray-800">{bale.group_number || 'N/A'}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-semibold text-gray-600">Current Lot:</Text>
              <Text className="text-gray-800">{bale.lot_number || 'N/A'}</Text>
            </View>
          </View>

          {/* Edit Form */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <Text className="text-lg font-bold text-[#65435C] mb-4">Edit Bale Details</Text>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Scale Barcode</Text>
              <View className="flex-row">
                <TextInput
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Scale Barcode"
                  placeholderTextColor="#9CA3AF"
                  value={scaleBarcode}
                  onChangeText={setScaleBarcode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity 
                  className="bg-[#65435C] rounded-lg p-3 ml-2 justify-center"
                  onPress={handleScanBarcode}
                >
                  <Camera color="white" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Group Number</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Group Number"
                placeholderTextColor="#9CA3AF"
                value={groupNumber}
                onChangeText={setGroupNumber}
                keyboardType="numeric"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Lot Number</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Lot Number"
                placeholderTextColor="#9CA3AF"
                value={lotNumber}
                onChangeText={setLotNumber}
                keyboardType="numeric"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-lg py-4 items-center"
                onPress={() => router.back()}
                disabled={isUpdating}
              >
                <Text className="text-gray-800 font-semibold text-lg">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className={`flex-1 rounded-lg py-4 items-center ${isUpdating ? 'bg-gray-400' : 'bg-[#65435C]'}`}
                onPress={handleUpdateBale}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-lg">Update Bale</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditBaleScreen;

