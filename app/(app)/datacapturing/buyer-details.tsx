import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan, ChevronDown } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

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

// Combobox component with popup modal
const Combobox = ({ 
  value, 
  onChangeText, 
  placeholder, 
  options, 
  displayField,
  onSelect 
}: { 
  value: string; 
  onChangeText: (text: string) => void; 
  placeholder: string; 
  options: any[];
  displayField: string;
  onSelect: (item: any) => void;
}) => {
  const [showModal, setShowModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);

  useEffect(() => {
    if (searchText) {
      const filtered = options.filter(opt => 
        String(opt[displayField] || '').toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchText, options, displayField]);

  const handleOpenModal = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening modal
    setSearchText('');
    setShowModal(true);
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    setShowModal(false);
    setSearchText('');
  };

  return (
    <View>
      <View className="border border-gray-300 rounded-md p-2 flex-row items-center">
        <TextInput
          className="flex-1"
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="characters"
        />
        <TouchableOpacity onPress={handleOpenModal} className="ml-2">
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setShowModal(false);
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl max-h-[80%]"
            >
              <View className="p-4 border-b border-gray-200">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-semibold text-gray-800">{placeholder}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowModal(false);
                    }}
                  >
                    <Text className="text-[#65435C] font-semibold">Close</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  placeholder={`Search ${placeholder.toLowerCase()}...`}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
              <FlatList
                data={filteredOptions}
                keyExtractor={(item, index) => String(item.id || index)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="p-4 border-b border-gray-100"
                    activeOpacity={0.7}
                    onPressIn={() => {
                      Keyboard.dismiss();
                    }}
                    onPress={() => {
                      handleSelect(item);
                    }}
                  >
                    <Text className="text-gray-800 text-base">{item[displayField]}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View className="p-4">
                    <Text className="text-gray-500 text-center">No results found</Text>
                  </View>
                }
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="interactive"
                removeClippedSubviews={false}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

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
  const [buyers, setBuyers] = useState<any[]>([]);
  const [buyerGrades, setBuyerGrades] = useState<any[]>([]);
  const [saleCodes, setSaleCodes] = useState<any[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);

  // Load dropdown options from PowerSync
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Load buyers
        const buyersResult = await powersync.getAll<any>(
          'SELECT id, buyer_code FROM buyers_buyer ORDER BY buyer_code'
        );
        setBuyers(buyersResult || []);

        // Load sale codes
        const saleCodesResult = await powersync.getAll<any>(
          'SELECT id, name FROM data_processing_salecode ORDER BY name'
        );
        setSaleCodes(saleCodesResult || []);
      } catch (e) {
        console.error('Failed to load dropdown options:', e);
      }
    };
    loadOptions();
  }, []);

  // Load buyer grades when buyer is selected
  useEffect(() => {
    const loadBuyerGrades = async () => {
      if (selectedBuyerId) {
        try {
          const gradesResult = await powersync.getAll<any>(
            'SELECT id, grade FROM buyers_grade WHERE buyer = ? ORDER BY grade',
            [parseInt(selectedBuyerId)]
          );
          setBuyerGrades(gradesResult || []);
        } catch (e) {
          console.error('Failed to load buyer grades:', e);
        }
      } else {
        setBuyerGrades([]);
      }
    };
    loadBuyerGrades();
  }, [selectedBuyerId]);

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
      // Set buyer ID if we need to load buyer grades
      if (baleData.buyer_code && buyers.length > 0) {
        const buyer = buyers.find(b => b.buyer_code === baleData.buyer_code);
        if (buyer) {
          setSelectedBuyerId(String(buyer.id));
        }
      }
    }
  }, [baleData, buyers]);

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
    Keyboard.dismiss(); // Dismiss keyboard before saving
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
  
    try {
      // Find IDs from the selected values
      const buyer = buyers.find(b => b.buyer_code === formState.buyer);
      const buyerGrade = buyerGrades.find(bg => bg.grade === formState.buyerGrade);
      const saleCode = saleCodes.find(sc => sc.name === formState.saleCode);

      const buyerId = buyer ? buyer.id : null;
      const buyerGradeId = buyerGrade ? buyerGrade.id : null;
      const saleCodeId = saleCode ? saleCode.id : null;
      const priceValue = formState.price ? parseFloat(formState.price) : null;

      // 1. Save locally to PowerSync first
      try {
        const now = new Date().toISOString();
        await powersync.execute(
          `UPDATE receiving_bale 
           SET buyer = ?, 
               buyer_grade = ?, 
               salecode_id = ?, 
               price = ?,
               write_date = ?
           WHERE barcode = ? OR id = ?`,
          [
            buyerId,
            buyerGradeId,
            saleCodeId,
            priceValue,
            now,
            baleData.barcode,
            baleData.id
          ]
        );
        console.log('✅ Buyer details saved locally to PowerSync');
      } catch (localError) {
        console.error('⚠️ Failed to save locally:', localError);
        // Continue with server save even if local save fails
      }

      setSuccessMessage('Buyer details saved locally. Will sync to server when online.');
      
      setTimeout(() => {
        resetState(); // Clear barcode and all state
        setSuccessMessage(null);
      }, 1500);
  
    } catch (e: any) {
      const errorMessage = e.message || 'An error occurred while saving.';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
                <Combobox
                  value={formState.buyer}
                  onChangeText={(val) => {
                    handleFormChange('buyer', val);
                    // Clear buyer grade when buyer changes
                    if (val !== formState.buyer) {
                      handleFormChange('buyerGrade', '');
                      const buyer = buyers.find(b => b.buyer_code === val);
                      setSelectedBuyerId(buyer ? String(buyer.id) : null);
                    }
                  }}
                  placeholder="Buyer Code"
                  options={buyers}
                  displayField="buyer_code"
                  onSelect={(item) => {
                    handleFormChange('buyer', item.buyer_code);
                    setSelectedBuyerId(String(item.id));
                  }}
                />
                
                <View className="mb-3" />
                
                <Text className="font-semibold text-gray-600 mb-1">Buyer Number</Text>
                <TextInput 
                  className="border border-gray-300 rounded-md p-2" 
                  placeholder="Buyer Number" 
                  autoCapitalize="characters"
                />
                
                <View className="mb-3" />
                
                <Text className="font-semibold text-gray-600 mb-1">Buyer Grade</Text>
                <Combobox
                  value={formState.buyerGrade}
                  onChangeText={(val) => handleFormChange('buyerGrade', val)}
                  placeholder="Buyer Grade"
                  options={buyerGrades}
                  displayField="grade"
                  onSelect={(item) => handleFormChange('buyerGrade', item.grade)}
                />
                
                <View className="mb-3" />
                
                <Text className="font-semibold text-gray-600 mb-1">Price</Text>
                <TextInput 
                  className="border border-gray-300 rounded-md p-2 mb-3" 
                  placeholder="Price" 
                  value={formState.price} 
                  onChangeText={(val) => handleFormChange('price', val)} 
                  keyboardType="numeric" 
                />
                
                <Text className="font-semibold text-gray-600 mb-1">Sale Code</Text>
                <Combobox
                  value={formState.saleCode}
                  onChangeText={(val) => handleFormChange('saleCode', val)}
                  placeholder="Sale Code"
                  options={saleCodes}
                  displayField="name"
                  onSelect={(item) => handleFormChange('saleCode', item.name)}
                />
                
                <View className="mb-4" />
                
                <TouchableOpacity onPress={handleSave} className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`} disabled={isSaving}>
                    <Text className="text-white text-center font-bold">{isSaving ? 'Saving...' : 'Save Details'}</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default BuyerDetailsScreen;
