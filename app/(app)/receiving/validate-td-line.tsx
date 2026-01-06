import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync, connectorInstance } from '@/powersync/setup';
import { ChevronLeft } from 'lucide-react-native';

type TDLine = {
  id: string;
  transporter_delivery_note_id?: number;
  grower_number?: string;
  grower_name?: string;
  location_id?: number;
  number_of_bales?: number;
  actual_bales_found?: number;
  bales_difference?: number;
  physical_validation_status?: string;
  validation_notes?: string;
  grower_delivery_note_id?: number; // Add this field
  preferred_sale_date?: string;
};

type TDNoteHeader = {
  id: string;
  state?: string;
};

export default function ValidateTDLineScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const lineId = String(params.id || '');

  const [line, setLine] = useState<TDLine | null>(null);
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const isValidated = line?.physical_validation_status === 'validated';
  const [header, setHeader] = useState<TDNoteHeader | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!lineId) {
          setLoading(false);
          return;
        }
        const row = await powersync.get<TDLine>(
          'SELECT * FROM receiving_boka_transporter_delivery_note_line WHERE id = ? LIMIT 1',
          [lineId]
        );
        if (row) {
          setLine(row);
          setActual(row.actual_bales_found != null ? String(row.actual_bales_found) : '');
          setNotes(row.validation_notes || '');

          // Load header to check state gating (must be booked)
          if (row.transporter_delivery_note_id != null) {
            const hdr = await powersync.get<TDNoteHeader>(
              'SELECT id, state FROM receiving_transporter_delivery_note WHERE id = ? LIMIT 1',
              [String(row.transporter_delivery_note_id)]
            );
            if (hdr) setHeader(hdr);
          }
        }
      } catch (e) {
        console.error('Failed to load line', e);
      } finally {
        setLoading(false);
      }
    };
    if (lineId) load();
  }, [lineId]);

  const handleValidate = async () => {
    if (!line) return;

    // New Pre-validation: Check if sale date has been entered for today
    try {
      const rawSaleDate =
        line?.preferred_sale_date?.toString() || new Date().toISOString();
      const saleDateToValidate = rawSaleDate.includes('T')
        ? rawSaleDate.split('T')[0]
        : rawSaleDate.split(' ')[0];

      const saleDateRecord = await powersync.getOptional(
        'SELECT sale_date FROM floor_maintenance_sale_date_receiving WHERE sale_date = ? LIMIT 1',
        [saleDateToValidate]
      );

      if (!saleDateRecord) {
        Alert.alert(
          'Cannot Validate',
          `The sale date ${saleDateToValidate} has not been entered. Please contact the Floor Manager to set up the sale date in Odoo before proceeding.`
        );
        return;
      }
    } catch (e) {
      console.error('Failed to pre-validate sale date', e);
      Alert.alert('Error', 'Could not verify the sale date. Please check your connection and try again.');
      return;
    }


    // ===== ALL VALIDATIONS ARE LOCAL - NO SERVER CALLS =====
    
    // Local validation 1: Check if line exists
    if (!line.id) {
      Alert.alert('Error', 'Line ID is missing. Cannot validate.');
      return;
    }

    // Local validation 2: Check header state (must be 'checked')
    const headerState = (header?.state || '').toLowerCase();
    if (headerState !== 'checked') {
      Alert.alert('Cannot Validate', 'Validation is only allowed when the delivery note is in "checked" state. Please ensure the delivery note is checked first.');
      return;
    }

    // Local validation 3: Check if already validated (idempotency)
    if (line.physical_validation_status === 'validated') {
      Alert.alert('Already Validated', 'This line has already been validated. No changes needed.');
      return;
    }

    // Local validation 4: Validate actual bales input (required, non-negative integer)
    if (!actual || actual.trim() === '') {
      Alert.alert('Input Required', 'Please enter the actual number of bales found.');
      return;
    }

    const actualCount = parseInt(actual.trim(), 10);
    if (isNaN(actualCount)) {
      Alert.alert('Invalid Input', 'Actual bales must be a valid number.');
      return;
    }

    if (actualCount < 0) {
      Alert.alert('Invalid Input', 'Physical bales count cannot be negative.');
      return;
    }

    // Local validation 5: Ensure expected bales is valid
    const expected = line.number_of_bales || 0;
    if (expected < 0) {
      Alert.alert('Data Error', 'Expected bales count is invalid. Please contact support.');
      return;
    }

    // Local validation 6: Require exact match - expected must equal actual
    if (actualCount !== expected) {
      Alert.alert(
        'Validation Failed', 
        `Expected bales (${expected}) must equal actual bales found (${actualCount}).\n\nPlease correct the count to match the expected value.`
      );
      return;
    }

    // All validations passed - now set validating state to disable button and show loading
    setValidating(true);

    // Calculate bales difference locally (should always be 0 if validation passes)
    const balesDifference = actualCount - expected;

    // Save original line for error recovery
    const originalLine = line;

    // ===== OPTIMISTIC UPDATE: Update UI immediately for instant feedback =====
    const updatedLine: TDLine = {
      ...(line as TDLine),
      actual_bales_found: actualCount,
      validation_notes: notes?.trim() || undefined,
      bales_difference: balesDifference,
      physical_validation_status: 'validated',
    };
    setLine(updatedLine);

    // Show success message immediately
    Alert.alert(
      '✓ Validated Successfully', 
      `Line validated successfully.\n\nExpected: ${expected} bales\nFound: ${actualCount} bales\nMatch: ✓\n\n`,
      [{ text: 'OK', onPress: () => router.back() }]
    );

    // ===== BACKGROUND: Save to database and trigger sync (fire and forget) =====
    // This runs in the background so the UI feels instant
    (async () => {
      try {
        const writeDate = new Date().toISOString();
        console.log('📝 Updating TD line locally:', {
          id: originalLine.id,
          actual_bales_found: actualCount,
          validation_notes: notes?.trim() || null,
          bales_difference: balesDifference,
          physical_validation_status: 'validated'
        });
        
        await powersync.execute(
          `UPDATE receiving_boka_transporter_delivery_note_line 
           SET actual_bales_found = ?, 
               validation_notes = ?, 
               bales_difference = ?,
               physical_validation_status = 'validated',
               write_date = ? 
           WHERE id = ?`,
          [actualCount, notes?.trim() || null, balesDifference, writeDate, originalLine.id]
        );
        
        console.log('✅ Local UPDATE completed - PowerSync should detect this change');

        // Trigger sync in background (non-blocking)
        setTimeout(async () => {
          try {
            const transaction = await (powersync as any).getNextCrudTransaction?.();
            if (transaction && connectorInstance && typeof connectorInstance.uploadData === 'function') {
              console.log(`✅ PowerSync detected pending transaction with ${transaction.crud?.length || 0} operations`);
              console.log('🔄 Manually triggering uploadData...');
              await connectorInstance.uploadData(powersync);
              console.log('✅ uploadData completed');
            }
          } catch (syncError) {
            console.warn('⚠️ Error during background sync:', syncError);
            // Don't show error to user - PowerSync will retry automatically
          }
        }, 300);
      } catch (e: any) {
        console.error('Failed to validate line locally', e);
        // Revert optimistic update on error
        setLine(originalLine);
        setValidating(false);
        const errorMessage = e?.message || 'An unknown error occurred during validation.';
        Alert.alert('Validation Error', `Failed to save validation :\n${errorMessage}\n\nPlease try again.`);
      } finally {
        // Already set to false in most paths, but ensure it is in the end
        setValidating(false);
      }
    })();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#65435C]"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: 'Validate TD Line', headerShown: false }} />
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="white" /></View>
      ) : !line ? (
        <View className="flex-1 items-center justify-center p-6"><Text className="text-white">Line not found.</Text></View>
      ) : (
        <View className="flex-1">
          {/* Custom header with back */}
          <View className="flex-row items-center justify-between mb-4 bg-white py-5 px-4">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color="#65435C" />
              <Text className="text-[#65435C] font-bold text-lg ml-2">
                Validate TD Line
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main content card */}
          <View className="flex-1 bg-white rounded-2xl p-4 mx-2">
            <ScrollView 
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-bold text-[#65435C] mb-2">{line.grower_number || line.grower_number}</Text>
                <Text className="text-gray-700">{line.grower_name || line.grower_number}</Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-1 font-semibold">Actual Bales Found</Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base text-gray-900"
                  style={{ color: '#111827' }}
                  keyboardType="number-pad"
                  onChangeText={setActual}
                  editable={!isValidated && !validating}
                  placeholder="Enter actual bales found"
                  placeholderTextColor="#65435C"
                />
              </View>

              <TouchableOpacity
                className={`${isValidated || (header?.state || '').toLowerCase() !== 'checked' || validating ? 'bg-gray-400' : 'bg-green-600'} p-4 rounded-lg items-center mb-4`}
                onPress={handleValidate}
                disabled={isValidated || (header?.state || '').toLowerCase() !== 'checked' || validating}
              >
                {validating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">
                    {isValidated ? 'Validated' : (header?.state || '').toLowerCase() !== 'checked' ? 'Validate (Book first)' : 'Validate Line'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}


