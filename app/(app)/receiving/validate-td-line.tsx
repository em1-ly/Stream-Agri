import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import * as SecureStore from 'expo-secure-store';

type TDLine = {
  id: string;
  transporter_delivery_note_id?: number;
  grower_number?: string;
  grower_name?: string;
  location_id?: number;
  number_of_bales?: number;
  actual_bales_found?: number;
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
    if ((header?.state || '').toLowerCase() !== 'checked') {
      Alert.alert('Not Booked', 'Validation is only allowed when the delivery note is Booked.');
      return;
    }
    // Enforce exact match (Odoo wizard requires exact physical count)
    const expected = line.number_of_bales || 0;
    const actualCount = parseInt(actual || '0', 10);
    if (isNaN(actualCount)) {
      Alert.alert('Invalid', 'Actual bales must be a number');
      return;
    }
    if (actualCount !== expected) {
      Alert.alert('Mismatch', `Expected ${expected} bales, but found ${actualCount}. Please correct to proceed.`);
      return;
    }

    const status = 'validated';

  try {
      // API-first: call backend endpoint that runs the Odoo validation wizard flow
      // Match Connector.ts: read base URL and token from SecureStore and normalize
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const foToken = await SecureStore.getItemAsync('odoo_custom_session_id');
      const normalizeServerUrl = (url: string | null): string => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
      };
      const apiBase = normalizeServerUrl(serverURL);
      if (!apiBase || !foToken) {
        Alert.alert('Error', 'Missing API base or session token. Please login again.');
        return;
      }
      const payload = {
        line_id: Number(line.id) || line.id,
        physical_bales: actualCount,
        notes,
      };
      const url = `${apiBase.replace(/\/$/, '')}/api/fo/receiving/td_line/validate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-FO-TOKEN': foToken },
        body: JSON.stringify(payload)
      });
      console.log('[TD Validate] Request URL:', url);
      console.log('[TD Validate] Payload:', payload);
      console.log('[TD Validate] Response status:', res.status, 'content-type:', res.headers.get('content-type'));
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      let body: any = null;
      if (contentType.includes('application/json')) {
        try { body = await res.json(); } catch (e) { body = null; console.warn('[TD Validate] JSON parse failed:', e); }
        console.log('[TD Validate] JSON body:', body);
      } else if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[TD Validate] Non-JSON error body:', text);
        Alert.alert('Validation failed', text || `HTTP ${res.status}`);
        return;
      }
      if (!res.ok || (body && (body.success === false || body.ok === false))) {
        Alert.alert('Validation failed', (body && (body.error || body.message)) || `HTTP ${res.status}`);
        return;
      }

      // Mirror minimal fields locally for instant UI
      console.log('[TD Validate] Mirroring local line:', line.id);
      await powersync.execute(
        'UPDATE receiving_boka_transporter_delivery_note_line SET actual_bales_found = ?, physical_validation_status = ?, validation_notes = ?, grower_delivery_note_id = COALESCE(?, grower_delivery_note_id), write_date = ? WHERE id = ?',
        [
          actualCount,
          'validated',
          notes,
          body?.line?.grower_delivery_note_id ?? null,
          new Date().toISOString(),
          line.id
        ]
      );
      console.log('[TD Validate] Local mirror done for line:', line.id);
      // Reflect validated state locally and keep user on the screen
      setLine({
        ...(line as TDLine),
        actual_bales_found: actualCount,
        physical_validation_status: status,
        validation_notes: notes,
      });
      Alert.alert('Success', 'Line validated');
    } catch (e) {
      console.error('Failed to validate line', e);
      Alert.alert('Error', 'Failed to validate line');
    }
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
              editable={!isValidated}
            />
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
            className={`${isValidated || (header?.state || '').toLowerCase() !== 'checked' ? 'bg-gray-400' : 'bg-green-600'} p-4 rounded-lg items-center mb-4`}
            onPress={handleValidate}
            disabled={isValidated || (header?.state || '').toLowerCase() !== 'checked'}
          >
            <Text className="text-white font-bold">
              {isValidated ? 'Validated' : (header?.state || '').toLowerCase() !== 'checked' ? 'Validate (Book first)' : 'Validate Line'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}


