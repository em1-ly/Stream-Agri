import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  grower_number: string;
  // Fields from the screenshot
  sale_date?: string;
  number_of_bales_delivered?: number;
  group_number?: number;
  lot_number?: string;
  current_seq?: number;
  // Hessian (optional if available in local schema) 
  hessian_name?: string;
  // Editable fields
  timb_grade_name?: string;
  buyer_code?: string;
  buyer_grade_grade?: string;
  price?: number;
  salecode_name?: string;
}

interface AllDetailsFormState {
    timbGrade: string;
    buyer: string;
    buyerGrade: string;
    price: string;
    saleCode: string;
    hessian: string;
    lotNumber: string;
    groupNumber: string;
}

const AllDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<AllDetailsFormState>({
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
    Keyboard.dismiss();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
  
    try {
      // Resolve names/codes to IDs
      let timbGradeId: number | null = null;
      let buyerId: number | null = null;
      let buyerGradeId: number | null = null;
      let salecodeId: number | null = null;
      let hessianId: number | null = null;

      // Resolve TIMB Grade
      if (formState.timbGrade) {
        const timbGrade = await powersync.get<any>(
          'SELECT id FROM floor_maintenance_timb_grade WHERE name = ? LIMIT 1',
          [formState.timbGrade.toUpperCase()]
        );
        if (timbGrade) {
          timbGradeId = timbGrade.id;
        } else {
          throw new Error(`TIMB Grade "${formState.timbGrade}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer
      if (formState.buyer) {
        const buyer = await powersync.get<any>(
          'SELECT id FROM buyers_buyer WHERE buyer_code = ? LIMIT 1',
          [formState.buyer.toUpperCase()]
        );
        if (buyer) {
          buyerId = buyer.id;
        } else {
          throw new Error(`Buyer "${formState.buyer}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer Grade (depends on buyer)
      if (formState.buyerGrade && buyerId) {
        const buyerGrade = await powersync.get<any>(
          'SELECT id FROM buyers_grade WHERE grade = ? AND buyer = ? LIMIT 1',
          [formState.buyerGrade.toUpperCase(), buyerId]
        );
        if (buyerGrade) {
          buyerGradeId = buyerGrade.id;
        } else {
          throw new Error(`Buyer Grade "${formState.buyerGrade}" not found for buyer "${formState.buyer}". Please sync the app.`);
        }
      } else if (formState.buyerGrade && !buyerId) {
        throw new Error('Cannot set Buyer Grade without a valid Buyer.');
      }

      // Resolve Sale Code
      if (formState.saleCode) {
        const salecode = await powersync.get<any>(
          'SELECT id FROM data_processing_salecode WHERE name = ? LIMIT 1',
          [formState.saleCode.toUpperCase()]
        );
        if (salecode) {
          salecodeId = salecode.id;
        } else {
          throw new Error(`Sale Code "${formState.saleCode}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Hessian
      if (formState.hessian) {
        const hessian = await powersync.get<any>(
          'SELECT id FROM receiving_hessian WHERE name = ? LIMIT 1',
          [formState.hessian]
        );
        if (hessian) {
          hessianId = hessian.id;
        } else {
          throw new Error(`Hessian "${formState.hessian}" not found locally. Please sync the app.`);
        }
      }

      // Update the bale with resolved IDs
      await powersync.execute(
        `UPDATE receiving_bale SET
          timb_grade = ?,
          buyer = ?,
          buyer_grade = ?,
          price = ?,
          salecode_id = ?,
          hessian = ?,
          lot_number = ?,
          group_number = ?,
          write_date = ?
        WHERE id = ?`,
        [
          timbGradeId,
          buyerId,
          buyerGradeId,
          formState.price ? parseFloat(formState.price) : null,
          salecodeId,
          hessianId,
          formState.lotNumber || null,
          formState.groupNumber ? parseInt(formState.groupNumber, 10) : null,
          new Date().toISOString(),
          baleData.id
        ]
      );

      setSuccessMessage('All details saved locally. Will sync to server.');
      
      setTimeout(() => {
          fetchBaleData(baleData.barcode);
          setSuccessMessage(null);
      }, 1500);
  
    } catch (e: any) {
      const errorMessage = e.message || 'An error occurred while saving.';
      Alert.alert('Error', `Failed to save details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndRelease = async () => {
    if (!baleData) {
      Alert.alert('Error', 'No bale loaded to release.');
      return;
    }
    Keyboard.dismiss();
    setIsReleasing(true);
    setError(null);
    try {
      // Resolve names/codes to IDs
      let timbGradeId: number | null = null;
      let buyerId: number | null = null;
      let buyerGradeId: number | null = null;
      let salecodeId: number | null = null;
      let hessianId: number | null = null;

      // Resolve TIMB Grade
      if (formState.timbGrade) {
        const timbGrade = await powersync.get<any>(
          'SELECT id FROM floor_maintenance_timb_grade WHERE name = ? LIMIT 1',
          [formState.timbGrade.toUpperCase()]
        );
        if (timbGrade) {
          timbGradeId = timbGrade.id;
        } else {
          throw new Error(`TIMB Grade "${formState.timbGrade}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer
      if (formState.buyer) {
        const buyer = await powersync.get<any>(
          'SELECT id FROM buyers_buyer WHERE buyer_code = ? LIMIT 1',
          [formState.buyer.toUpperCase()]
        );
        if (buyer) {
          buyerId = buyer.id;
        } else {
          throw new Error(`Buyer "${formState.buyer}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer Grade (depends on buyer)
      if (formState.buyerGrade && buyerId) {
        const buyerGrade = await powersync.get<any>(
          'SELECT id FROM buyers_grade WHERE grade = ? AND buyer = ? LIMIT 1',
          [formState.buyerGrade.toUpperCase(), buyerId]
        );
        if (buyerGrade) {
          buyerGradeId = buyerGrade.id;
        } else {
          throw new Error(`Buyer Grade "${formState.buyerGrade}" not found for buyer "${formState.buyer}". Please sync the app.`);
        }
      } else if (formState.buyerGrade && !buyerId) {
        throw new Error('Cannot set Buyer Grade without a valid Buyer.');
      }

      // Resolve Sale Code
      if (formState.saleCode) {
        const salecode = await powersync.get<any>(
          'SELECT id FROM data_processing_salecode WHERE name = ? LIMIT 1',
          [formState.saleCode.toUpperCase()]
        );
        if (salecode) {
          salecodeId = salecode.id;
        } else {
          throw new Error(`Sale Code "${formState.saleCode}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Hessian
      if (formState.hessian) {
        const hessian = await powersync.get<any>(
          'SELECT id FROM receiving_hessian WHERE name = ? LIMIT 1',
          [formState.hessian]
        );
        if (hessian) {
          hessianId = hessian.id;
        } else {
          throw new Error(`Hessian "${formState.hessian}" not found locally. Please sync the app.`);
        }
      }

      // Update the bale with resolved IDs and set is_released
      await powersync.execute(
        `UPDATE receiving_bale SET
          timb_grade = ?,
          buyer = ?,
          buyer_grade = ?,
          price = ?,
          salecode_id = ?,
          hessian = ?,
          lot_number = ?,
          group_number = ?,
          is_released = 1,
          write_date = ?
        WHERE id = ?`,
        [
          timbGradeId,
          buyerId,
          buyerGradeId,
          formState.price ? parseFloat(formState.price) : null,
          salecodeId,
          hessianId,
          formState.lotNumber || null,
          formState.groupNumber ? parseInt(formState.groupNumber, 10) : null,
          new Date().toISOString(),
          baleData.id
        ]
      );

      // Offline success path
      Alert.alert('Success', 'Bale saved and release queued (offline).');
      await fetchBaleData(baleData.barcode);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save and release');
    } finally {
      setIsReleasing(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/all-details' }
    });
  };

  const handleFormChange = (name: keyof AllDetailsFormState, value: string) => {
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text className="text-xl font-bold text-center mb-4 text-[#65435C]">All Details</Text>
      
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
                <Text className="text-lg font-semibold mb-2 text-gray-700">Enter All Details</Text>

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
                
                <TouchableOpacity onPress={handleSaveAndRelease} className={`p-3 rounded-md ${isReleasing ? 'bg-gray-400' : 'bg-green-600'}`} disabled={isReleasing}>
                  {isReleasing ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator color="white" size="small" className="mr-2" />
                      <Text className="text-white text-center font-bold">Releasing...</Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-bold">Release Bale</Text>
                  )}
                </TouchableOpacity>
            </View>
        </View>
      )}
    </ScrollView>
  );
};

export default AllDetailsScreen;
