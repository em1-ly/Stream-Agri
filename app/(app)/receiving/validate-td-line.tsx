import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync, connectorInstance } from '@/powersync/system';

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

    // Calculate bales difference locally (should always be 0 if validation passes)
    const balesDifference = actualCount - expected;

    // Save original line for error recovery
    const originalLine = line;

    // Set validating state to disable button and show loading
    setValidating(true);

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
        setValidating(false);
      }
    })();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: 'Validate TD Line', headerTitleStyle: { fontSize: 20, fontWeight: 'bold', color: '#65435C' } }} />
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : !line ? (
        <View className="flex-1 items-center justify-center p-6"><Text>Line not found.</Text></View>
      ) : (
        <ScrollView 
          className="flex-1 p-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-2">{line.grower_number || line.grower_number}</Text>
            <Text className="text-gray-700">{line.grower_name || line.grower_number}</Text>
            <Text className="text-gray-500">Expected bales: {line.number_of_bales || 0}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Actual Bales Found</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              keyboardType="number-pad"
              onChangeText={setActual}
              editable={!isValidated && !validating}
              placeholder="Enter actual bales found"
            />
            {actual && !isNaN(parseInt(actual, 10)) && (
              <Text className="text-sm mt-1 text-gray-600">
                Difference: {parseInt(actual, 10) - (line.number_of_bales || 0)} bales
                {parseInt(actual, 10) - (line.number_of_bales || 0) > 0 && ' (extra)'}
                {parseInt(actual, 10) - (line.number_of_bales || 0) < 0 && ' (missing)'}
                {parseInt(actual, 10) - (line.number_of_bales || 0) === 0 && ' (match)'}
              </Text>
            )}
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 mb-1 font-semibold">Notes</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              editable={!isValidated}
              multiline
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
      )}
    </KeyboardAvoidingView>
  );
}


