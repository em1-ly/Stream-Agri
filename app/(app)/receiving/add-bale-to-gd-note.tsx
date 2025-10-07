import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Search, Camera } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord } from '@/powersync/Schema';

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
  const [location, setLocation] = useState('');

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

  const handleSearchWithBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      return;
    }
    try {
      const result = await powersync.get<GrowerDeliveryNoteRecord>(
        'SELECT * FROM receiving_grower_delivery_note WHERE document_number = ?',
        [barcode.trim()]
      );
      if (result) {
        setGrowerNote(result);
      } else {
        setGrowerNote(null);
        Alert.alert('Not Found', `Grower Delivery Note with Document Number "${barcode}" not found.`);
      }
    } catch (error) {
      console.error('Failed to fetch grower note:', error);
      Alert.alert('Error', 'An error occurred while fetching the delivery note.');
    }
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
          
          // Show alert with debug info
          Alert.alert(
            'Debug Info',
            `Document: ${result.document_number}\n` +
            `ID: ${result.id}\n` +
            `Declared: ${result.number_of_bales || 'null'}\n` +
            `Delivered (from DB): ${result.number_of_bales_delivered || 'null'}\n` +
            `Bales in DB: ${baleCount?.count || 0}`
          );
          
          // Update the result with the actual count
          if (baleCount) {
            result.number_of_bales_delivered = baleCount.count;
          }
        } catch (countError) {
          console.error('❌ Error counting bales:', countError);
          Alert.alert('Error', 'Failed to count bales: ' + String(countError));
        }
        
        setGrowerNote(result);
      } else {
        setGrowerNote(null);
        Alert.alert('Not Found', `Grower Delivery Note with Document Number "${documentNumber}" not found.`);
      }
    } catch (error) {
      console.error('Failed to fetch grower note:', error);
      Alert.alert('Error', 'An error occurred while fetching the delivery note.');
    }
  };

  const handleSaveBale = async () => {
    if (!growerNote) {
      Alert.alert('Error', 'No Grower Delivery Note selected.');
      return;
    }

    if (!scaleBarcode || !lotNumber || !groupNumber || !location) {
      Alert.alert('Error', 'Please fill in all bale details.');
      return;
    }

    try {
      const baleId = uuidv4();
      await powersync.execute(
        'INSERT INTO receiving_bale (id, grower_delivery_note_id, document_number, scale_barcode, lot_number, group_number, location_id, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [baleId, growerNote.id, growerNote.document_number, scaleBarcode, lotNumber, groupNumber, location, 'open']
      );

      Alert.alert('Success', 'Bale saved successfully.');

      // Clear form fields
      setScaleBarcode('');
      setLotNumber('');
      setGroupNumber('');
      // setLocation('');

      // Update the bale count by querying the database
      if (growerNote) {
        try {
          const baleCount = await powersync.get<{ count: number }>(
            'SELECT COUNT(*) as count FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ?',
            [growerNote.id, growerNote.document_number]
          );
          console.log('📦 Updated bale count:', baleCount?.count || 0);
          
          setGrowerNote((prevNote) => {
            if (!prevNote) return null;
            return {
              ...prevNote,
              number_of_bales_delivered: baleCount?.count || 0
            };
          });
        } catch (countError) {
          console.error('Error updating bale count:', countError);
        }
      }
    } catch (error) {
      console.error('Failed to save bale:', error);
      Alert.alert('Error', 'An error occurred while saving the bale.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#65435C]"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1 bg-white rounded-2xl p-5 m-4">
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
              <Text className="text-base text-gray-600 font-medium">Bales Declared:</Text>
              <Text className="text-base text-gray-800">{growerNote.number_of_bales || 0}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-base text-gray-600 font-medium">Bales Delivered:</Text>
              <Text className="text-base text-gray-800">{growerNote.number_of_bales_delivered || 0}</Text>
            </View>
           
          </View>
        )}

        {growerNote && (
          <View className="mt-2.5">
            <Text className="text-xl font-bold text-[#65435C] mb-4">Add New Bale</Text>
            <View className="flex-row mb-3">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
                placeholder="Scale Barcode"
                value={scaleBarcode}
                onChangeText={setScaleBarcode}
              />
              <TouchableOpacity 
                className="bg-[#65435C] rounded-lg p-3 ml-2 justify-center" 
                onPress={() => router.push({
                  pathname: '/receiving/barcode-scanner',
                  params: { 
                    scanType: 'bale',
                    documentNumber: documentNumber 
                  }
                })}
              >
                <Camera color="white" size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-3"
              placeholder="Lot Number"
              value={lotNumber}
              onChangeText={setLotNumber}
              keyboardType="numeric"
            />
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-3"
              placeholder="Group Number"
              value={groupNumber}
              onChangeText={setGroupNumber}
              keyboardType="numeric"
            />
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-3"
              placeholder="Location"
              value={location}
              onChangeText={setLocation}
            />
            <TouchableOpacity className="bg-[#65435C] rounded-lg py-3.5 items-center mt-2.5" onPress={handleSaveBale}>
              <Text className="text-white text-base font-bold">Save Bale</Text>
            </TouchableOpacity>
    </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
