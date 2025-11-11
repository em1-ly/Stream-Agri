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
  grower_number: string;
  sale_date?: string;
  number_of_bales_delivered?: number;
  group_number?: number;
  lot_number?: string;
  current_seq?: number;
  hessian_name?: string;
  timb_grade_name?: string;
  buyer_code?: string;
  buyer_grade_grade?: string;
  price?: number;
  salecode_name?: string;
}

interface AbitrationFormState {
  timbGrade: string;
  buyer: string;
  buyerGrade: string;
  price: string;
  saleCode: string;
  hessian: string;
  lotNumber: string;
  groupNumber: string;
}

const AbitrationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<AbitrationFormState>({
    timbGrade: '',
    buyer: '',
    buyerGrade: '',
    price: '',
    saleCode: '',
    hessian: '',
    lotNumber: '',
    groupNumber: '',
  });

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode && scannedBarcode !== barcode) {
      fetchBaleData(scannedBarcode);
    }
  }, [params.scannedBarcode]);

  useEffect(() => {
    if (baleData) {
      setFormState({
        timbGrade: baleData.timb_grade_name || '',
        buyer: baleData.buyer_code || '',
        buyerGrade: baleData.buyer_grade_grade || '',
        price: baleData.price?.toString() || '',
        saleCode: baleData.salecode_name || '',
        hessian: baleData.hessian_name || '',
        lotNumber: baleData.lot_number || '',
        groupNumber: baleData.group_number?.toString() || '',
      });
    }
  }, [baleData]);

  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) setBarcode('');
    setBaleData(null);
    setError(null);
    setSuccessMessage(null);
    setFormState({ timbGrade: '', buyer: '', buyerGrade: '', price: '', saleCode: '', hessian: '', lotNumber: '', groupNumber: '' });
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
          rb.group_number,
          rb.lot_number,
          rb.current_seq,
          rb.price,
          gdn.grower_number,
          gdn.selling_date as sale_date,
          gdn.number_of_bales_delivered,
          tg.name as timb_grade_name,
          b.buyer_code,
          bg.grade as buyer_grade_grade,
          cs.name as salecode_name,
          rh.name as hessian_name
        FROM receiving_bale AS rb
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN buyers_buyer AS b ON rb.buyer = b.id
        LEFT JOIN buyers_grade AS bg ON rb.buyer_grade = bg.id
        LEFT JOIN data_processing_salecode AS cs ON rb.salecode_id = cs.id
        LEFT JOIN receiving_hessian AS rh ON rb.hessian = rh.id
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
        timb_grade: formState.timbGrade,
        buyer: formState.buyer,
        buyer_grade: formState.buyerGrade,
        price: formState.price,
        salecode_id: formState.saleCode,
        hessian: formState.hessian,
        lot_number: formState.lotNumber,
        group_number: formState.groupNumber
      };
      
      const response = await updateBaleDataAPI(baleData.barcode, updates);

      if (response.data.result && response.data.result.success) {
        setSuccessMessage(response.data.result.message || 'Abitration details saved successfully!');
        
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
      Alert.alert('Error', `Failed to save details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/abitration' }
    });
  };

  const handleFormChange = (name: keyof AbitrationFormState, value: string) => {
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text className="text-xl font-bold text-center mb-4 text-[#65435C]">Arbitration</Text>
      
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
                <Text className="text-lg font-bold text-[#65435C] mb-3">Bale Details</Text>
                
                <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                  <Text className="font-semibold text-gray-600">Sale Date:</Text>
                  <Text className="text-gray-800">{baleData.sale_date || 'N/A'}</Text>
                </View>
                <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                  <Text className="font-semibold text-gray-600">No. of Bales:</Text>
                  <Text className="text-gray-800">{baleData.number_of_bales_delivered || 'N/A'}</Text>
                </View>
                <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                  <Text className="font-semibold text-gray-600">Barcode:</Text>
                  <Text className="text-gray-800">{baleData.barcode}</Text>
                </View>
                <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                  <Text className="font-semibold text-gray-600">Grower:</Text>
                  <Text className="text-gray-800">{baleData.grower_number}</Text>
                </View>

                <View className="flex-row mt-2">
                    <View className="flex-1 pr-2">
                        <Text className="font-semibold text-gray-600">Mass:</Text>
                        <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.mass} kg</Text>
                    </View>
                    <View className="flex-1 pl-2">
                        <Text className="font-semibold text-gray-600">SEQ:</Text>
                        <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.current_seq || 'N/A'}</Text>
                    </View>
                </View>

                 <View className="flex-row mt-2">
                    <View className="flex-1 pr-2">
                        <Text className="font-semibold text-gray-600">Group:</Text>
                        <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.group_number || 'N/A'}</Text>
                    </View>
                    <View className="flex-1 pl-2">
                        <Text className="font-semibold text-gray-600">Lot:</Text>
                        <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.lot_number || 'N/A'}</Text>
                    </View>
                </View>
            </View>

            <View className="bg-white p-4 rounded-lg shadow-md">
                <Text className="text-lg font-semibold mb-2 text-gray-700">Enter Abitration Details</Text>

                <Text className="font-semibold text-gray-600 mb-1">TIMB Grade / Reason</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="e.g., L1F" value={formState.timbGrade} onChangeText={(val) => handleFormChange('timbGrade', val)} autoCapitalize="characters" />

                <Text className="font-semibold text-gray-600 mb-1">Buyer</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Buyer Code" value={formState.buyer} onChangeText={(val) => handleFormChange('buyer', val)} autoCapitalize="characters" />
                
                <Text className="font-semibold text-gray-600 mb-1">Buyer Grade</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Buyer Grade" value={formState.buyerGrade} onChangeText={(val) => handleFormChange('buyerGrade', val)} autoCapitalize="characters" />
                
                <Text className="font-semibold text-gray-600 mb-1">Price</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Price" value={formState.price} onChangeText={(val) => handleFormChange('price', val)} keyboardType="numeric" />
                
                <Text className="font-semibold text-gray-600 mb-1">Sale Code</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Sale Code" value={formState.saleCode} onChangeText={(val) => handleFormChange('saleCode', val)} autoCapitalize="characters" />

                <Text className="font-semibold text-gray-600 mb-1">Hessian</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Hessian" value={formState.hessian} onChangeText={(val) => handleFormChange('hessian', val)} autoCapitalize="characters" />

                <Text className="font-semibold text-gray-600 mb-1">Lot Number</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholder="Lot Number" value={formState.lotNumber} onChangeText={(val) => handleFormChange('lotNumber', val)} autoCapitalize="characters" />

                <Text className="font-semibold text-gray-600 mb-1">Group Number</Text>
                <TextInput className="border border-gray-300 rounded-md p-2 mb-4" placeholder="Group Number" value={formState.groupNumber} onChangeText={(val) => handleFormChange('groupNumber', val)} keyboardType="numeric" />
                
                <TouchableOpacity onPress={handleSave} className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`} disabled={isSaving}>
                    {isSaving ? (
                        <View className="flex-row items-center justify-center">
                            <ActivityIndicator color="white" size="small" className="mr-2" />
                            <Text className="text-white text-center font-bold">Saving...</Text>
                        </View>
                    ) : (
                        <Text className="text-white text-center font-bold">Save Details</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      )}
    </ScrollView>
  );
};

export default AbitrationScreen;
