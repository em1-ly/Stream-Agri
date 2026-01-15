import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import apiClient from '@/api/odoo_api';
import { powersync } from '@/powersync/system';
import { Camera } from 'lucide-react-native';
import BarcodeScanner from '../../../../components/BarcodeScanner';

type MessageType = 'info' | 'success' | 'error';
type Grade = { id: number; name: string };

const MissingReceiptAddBalesScreen = () => {
  const params = useLocalSearchParams<{ missingDnoteId?: string }>();
  const [barcode, setBarcode] = useState('');
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [originalGradeId, setOriginalGradeId] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeSearch, setGradeSearch] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [mass, setMass] = useState('');
  const [receivedMass, setReceivedMass] = useState('');
  const [price, setPrice] = useState('');
  const [growerNumber, setGrowerNumber] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const rows = await powersync.getAll<Grade>(
          `SELECT id, name FROM warehouse_bale_grade ORDER BY name`
        );
        setGrades(rows || []);
      } catch (err) {
        console.error('Failed to load grades', err);
      }
    };
    loadGrades();
  }, []);

  const handleSave = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const code = overrideBarcode ?? barcode;
    if (!params.missingDnoteId) {
      Alert.alert('Missing context', 'Missing Receipt Note ID not provided.');
      return;
    }
    if (!code) {
      setMessage('Please scan or enter barcode.');
      setMessageType('error');
      return;
    }
    if (!gradeId || !originalGradeId) {
      setMessage('Please select grade and original grade.');
      setMessageType('error');
      return;
    }
    if (!mass || !receivedMass) {
      setMessage('Please enter mass and received mass.');
      setMessageType('error');
      return;
    }

    try {
      const payload = {
        jsonrpc: '2.0',
        params: {
          type: 'warehouse_missing_bale_save',
          data: {
            missing_dnote_id: Number(params.missingDnoteId),
            barcode: code,
            grade_id: gradeId,
            original_grade_id: originalGradeId,
            mass: parseFloat(mass),
            received_mass: parseFloat(receivedMass),
            lot_number: lotNumber || undefined,
            price: price ? parseFloat(price) : undefined,
            grower_number: growerNumber || undefined,
          },
        },
      };

      const response = await apiClient.post('/api/fo/create_unified', payload);
      const result = response.data?.result ?? response.data;

      if (!result?.success) {
        setMessage(result?.message || 'Failed to add bale.');
        setMessageType('error');
        return;
      }

      setMessage(result?.message || 'Bale added successfully.');
      setMessageType((result?.message_type as MessageType) || 'success');

      // Clear inputs for next bale
      setBarcode('');
      setLotNumber('');
      setMass('');
      setReceivedMass('');
      setPrice('');
      setGrowerNumber('');
    } catch (err: any) {
      console.error('Missing bale save error', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'System error while adding bale.';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const filteredGrades = grades.filter((g) =>
    g.name.toLowerCase().includes(gradeSearch.toLowerCase())
  );

  const messageBg =
    messageType === 'success'
      ? 'bg-green-100'
      : messageType === 'error'
      ? 'bg-red-100'
      : 'bg-blue-100';
  const messageText =
    messageType === 'success'
      ? 'text-green-800'
      : messageType === 'error'
      ? 'text-red-800'
      : 'text-blue-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Add Bales to Missing Receipt', headerShown: true }} />

      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            // 1) Hide instantly
            setScannerVisible(false);
            
            // 2) Defer
            setTimeout(() => {
            setBarcode(code);
              handleSave(code);
            }, 0);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Bale Barcode"
        />
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">Missing Receipt Note</Text>
            <Text className="text-base text-blue-900">
              ID: {params.missingDnoteId || 'N/A'}
            </Text>
            <Text className="text-base text-blue-900 mt-1">
              Enter bale details to add to the missing receipt note.
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Barcode *</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Enter or scan barcode..."
                value={barcode}
                onChangeText={setBarcode}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => handleSave()}
              />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScannerVisible(true);
                }}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Grade *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base mb-2"
              placeholder="Search grade..."
              value={gradeSearch}
              onChangeText={setGradeSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
              {filteredGrades.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  className={`p-3 border-b border-gray-200 ${gradeId === g.id ? 'bg-blue-100' : 'bg-white'}`}
                  onPress={() => setGradeId(g.id)}
                >
                  <Text className="text-base text-gray-900">{g.name}</Text>
                </TouchableOpacity>
              ))}
              {filteredGrades.length === 0 && (
                <Text className="text-center text-gray-500 py-3">No grades found</Text>
              )}
            </ScrollView>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Original Grade *</Text>
            <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
              {grades.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  className={`p-3 border-b border-gray-200 ${originalGradeId === g.id ? 'bg-blue-100' : 'bg-white'}`}
                  onPress={() => setOriginalGradeId(g.id)}
                >
                  <Text className="text-base text-gray-900">{g.name}</Text>
                </TouchableOpacity>
              ))}
              {grades.length === 0 && (
                <Text className="text-center text-gray-500 py-3">No grades synced</Text>
              )}
            </ScrollView>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Mass *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter mass..."
              value={mass}
              onChangeText={setMass}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Received Mass *</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter received mass..."
              value={receivedMass}
              onChangeText={setReceivedMass}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Lot Number (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter lot number..."
              value={lotNumber}
              onChangeText={setLotNumber}
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Price (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter price..."
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Grower Number (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter grower number..."
              value={growerNumber}
              onChangeText={setGrowerNumber}
              autoCapitalize="none"
            />
          </View>

          {message ? (
            <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
              <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => handleSave()}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Add Bale</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default MissingReceiptAddBalesScreen;



