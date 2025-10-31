import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { updateBaleDataAPI } from '@/api/odoo_api';

interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  timb_grade_name?: string;
  grower_number: string;
}

const ClassificationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timbGrade, setTimbGrade] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode && scannedBarcode !== barcode) {
      fetchBaleData(scannedBarcode);
    }
  }, [params.scannedBarcode]);


  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) {
      setBarcode('');
    }
    setBaleData(null);
    setError(null);
    setTimbGrade('');
    setSuccessMessage(null);
  }

  const fetchBaleData = async (scannedBarcode: string) => {
    if (!scannedBarcode) return;
    resetState(true);
    setBarcode(scannedBarcode);
    setLoading(true);
    Keyboard.dismiss();

    try {
        const query = `
        SELECT
          rb.id,
          rb.barcode,
          rb.mass,
          tg.name as timb_grade_name,
          gdn.grower_number
        FROM receiving_bale AS rb
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        WHERE rb.barcode = ?
      `;

      const result = await powersync.execute(query, [scannedBarcode]);
      
      if (result.rows && result.rows.length > 0) {
        setBaleData(result.rows._array[0] as BaleData);
      } else {
        setError('No bale found with this barcode.');
        setBaleData(null);
      }
    } catch (e) {
      const error = e as Error;
      console.error('Failed to fetch bale data:', error);
      Alert.alert('Error', `Failed to fetch bale data: ${error.message}`);
      setError('An error occurred while fetching bale data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!baleData || !timbGrade) {
        setError("Please enter a TIMB grade.");
        return;
    }
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updates = { timb_grade: timbGrade };
      const response = await updateBaleDataAPI(baleData.barcode, updates);

      if (response.data.result && response.data.result.success) {
        setSuccessMessage(response.data.result.message || 'TIMB Grade saved successfully!');
        
        // We can optionally trigger a refresh from local DB to show updated data after sync
        setTimeout(() => {
            fetchBaleData(baleData.barcode); // Re-fetch to show the new data
            setTimbGrade('');
            setSuccessMessage(null);
        }, 1500);

      } else {
        throw new Error(response.data.result.message || 'An unknown error occurred.');
      }
    } catch (e: any) {
        const errorMessage = e.response?.data?.error?.data?.message || e.message || 'An error occurred while saving the grade.';
        Alert.alert('Error', `Failed to save TIMB grade: ${errorMessage}`);
        setError(errorMessage);
    } finally {
        setIsSaving(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/classification' }
    });
  };

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text className="text-xl font-bold text-center mb-4 text-[#65435C]">Classification</Text>
      
      <View className="bg-white p-4 rounded-lg shadow-md mb-4">
        <Text className="text-lg font-semibold mb-2 text-gray-700">Barcode</Text>
        <View className="flex-row items-center">
          <TextInput
            className="flex-1 border border-gray-300 rounded-md p-2"
            placeholder="Enter or scan barcode"
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => fetchBaleData(barcode)}
          />
          <TouchableOpacity onPress={openScanner} className="ml-2 p-3 bg-[#1AD3BB] rounded-md">
            <Scan size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color="#65435C" />}
      {error && <Text className="text-red-500 text-center p-2">{error}</Text>}
      {successMessage && <Text className="text-green-500 text-center p-2">{successMessage}</Text>}

      {baleData && (
        <View>
            <View className="bg-white p-4 rounded-lg shadow-md mb-4">
                <Text className="text-lg font-bold text-[#65435C] mb-2">Bale Details</Text>
                <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-600">Barcode:</Text>
                    <Text>{baleData.barcode}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-600">Grower No:</Text>
                    <Text>{baleData.grower_number}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-600">Mass:</Text>
                    <Text>{baleData.mass} kg</Text>
                </View>
                <View className="flex-row justify-between">
                    <Text className="font-semibold text-gray-600">Current Grade:</Text>
                    <Text>{baleData.timb_grade_name || 'N/A'}</Text>
                </View>
            </View>

            <View className="bg-white p-4 rounded-lg shadow-md">
                <Text className="text-lg font-semibold mb-2 text-gray-700">Enter TIMB Grade / Reason</Text>
                <TextInput
                    className="border border-gray-300 rounded-md p-2 mb-4"
                    placeholder="e.g., L1F"
                    value={timbGrade}
                    onChangeText={setTimbGrade}
                    autoCapitalize="characters"
                />
                <TouchableOpacity 
                    onPress={handleSave} 
                    className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`}
                    disabled={isSaving}
                >
                    <Text className="text-white text-center font-bold">{isSaving ? 'Saving...' : 'Save Details'}</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}
      
    </ScrollView>
  );
};

export default ClassificationScreen;
