import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { updateBaleDataAPI } from '@/api/odoo_api';

// Define the structure for the bale data, including buyer details
interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  grower_number: string;
  timb_grade_name?: string;
  buyer_code?: string;
  buyer_grade_grade?: string;
  price?: number;
  salecode_name?: string;
}

// Define the structure for the form state
interface BuyerFormState {
    buyer: string;
    buyerGrade: string;
    price: string;
    saleCode: string;
}

const BuyerDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<BuyerFormState>({
    buyer: '',
    buyerGrade: '',
    price: '',
    saleCode: '',
  });

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode && scannedBarcode !== barcode) {
      fetchBaleData(scannedBarcode);
    }
  }, [params.scannedBarcode]);

  useEffect(() => {
    // Pre-fill the form when baleData is loaded
    if (baleData) {
      setFormState({
        buyer: baleData.buyer_code || '',
        buyerGrade: baleData.buyer_grade_grade || '',
        price: baleData.price?.toString() || '',
        saleCode: baleData.salecode_name || '',
      });
    }
  }, [baleData]);

  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) setBarcode('');
    setBaleData(null);
    setError(null);
    setSuccessMessage(null);
    setFormState({ buyer: '', buyerGrade: '', price: '', saleCode: '' });
  };

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
          gdn.grower_number,
          tg.name as timb_grade_name,
          b.buyer_code,
          bg.grade as buyer_grade_grade,
          rb.price,
          cs.name as salecode_name
        FROM receiving_bale AS rb
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN buyers_buyer AS b ON rb.buyer = b.id
        LEFT JOIN buyers_grade AS bg ON rb.buyer_grade = bg.id
        LEFT JOIN data_processing_salecode AS cs ON rb.salecode_id = cs.id
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
      Alert.alert('Error', `Failed to fetch bale data: ${error.message}`);
      setError('An error occurred while fetching bale data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!baleData) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
  
    try {
      const updates = {
        buyer: formState.buyer,
        buyer_grade: formState.buyerGrade,
        price: formState.price,
        salecode_id: formState.saleCode
      };

      const response = await updateBaleDataAPI(baleData.barcode, updates);

      if (response.data.result && response.data.result.success) {
        setSuccessMessage(response.data.result.message || 'Buyer details saved successfully!');
        
        setTimeout(() => {
            fetchBaleData(baleData.barcode);
            setSuccessMessage(null);
        }, 1500);
      } else {
        const errorList = response.data.result.errors || [];
        throw new Error(response.data.result.message || errorList.join(', ') || 'An unknown error occurred.');
      }
  
    } catch (e: any) {
      const errorMessage = e.response?.data?.error?.data?.message || e.message || 'An error occurred while saving.';
      Alert.alert('Error', `Failed to save buyer details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/buyer-details' }
    });
  };

  const handleFormChange = (name: keyof BuyerFormState, value: string) => {
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text className="text-xl font-bold text-center mb-4 text-[#65435C]">Buyer Details</Text>
      
      {/* Barcode Scanner Input */}
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

      {/* Bale Details and Form */}
      {baleData && (
        <View>
            <View className="bg-white p-4 rounded-lg shadow-md mb-4">
                <Text className="text-lg font-bold text-[#65435C] mb-2">Bale Details</Text>
                <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Barcode:</Text><Text>{baleData.barcode}</Text></View>
                <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Grower No:</Text><Text>{baleData.grower_number}</Text></View>
                <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Mass:</Text><Text>{baleData.mass} kg</Text></View>
                <View className="flex-row justify-between"><Text className="font-semibold text-gray-600">TIMB Grade:</Text><Text>{baleData.timb_grade_name || 'N/A'}</Text></View>
            </View>

            <View className="bg-white p-4 rounded-lg shadow-md">
                <Text className="text-lg font-semibold mb-2 text-gray-700">Enter Buyer Details</Text>
                <Text className="font-semibold text-gray-600 mb-1">Buyer</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Buyer Code" value={formState.buyer} onChangeText={(val) => handleFormChange('buyer', val)} autoCapitalize="characters" />
                <Text className="font-semibold text-gray-600 mb-1">Buyer Grade</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Buyer Grade" value={formState.buyerGrade} onChangeText={(val) => handleFormChange('buyerGrade', val)} autoCapitalize="characters" />
                <Text className="font-semibold text-gray-600 mb-1">Price</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Price" value={formState.price} onChangeText={(val) => handleFormChange('price', val)} keyboardType="numeric" />
                <Text className="font-semibold text-gray-600 mb-1">Sale Code</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-4" placeholder="Sale Code" value={formState.saleCode} onChangeText={(val) => handleFormChange('saleCode', val)} autoCapitalize="characters" />
                
                <TouchableOpacity onPress={handleSave} className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`} disabled={isSaving}>
                    <Text className="text-white text-center font-bold">{isSaving ? 'Saving...' : 'Save Details'}</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}
    </ScrollView>
  );
};

export default BuyerDetailsScreen;
