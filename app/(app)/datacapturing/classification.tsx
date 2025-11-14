import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan, ChevronDown } from 'lucide-react-native';
import { powersync } from '@/powersync/system';

// Toggle to enable/disable verbose logs for the save bale flow
const DEBUG_SAVE_LOGS = false;

interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  timb_grade_name?: string;
  grower_number: string;
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
  const [timbGrades, setTimbGrades] = useState<any[]>([]);

  // Load TIMB grades from PowerSync
  useEffect(() => {
    const loadTimbGrades = async () => {
      try {
        const gradesResult = await powersync.getAll<any>(
          'SELECT id, name FROM floor_maintenance_timb_grade ORDER BY name'
        );
        setTimbGrades(gradesResult || []);
      } catch (e) {
        if (DEBUG_SAVE_LOGS) console.error('Failed to load TIMB grades:', e);
      }
    };
    loadTimbGrades();
  }, []);

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
      if (DEBUG_SAVE_LOGS) console.error('Failed to fetch bale data:', error);
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
    Keyboard.dismiss(); // Dismiss keyboard before saving
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Find the ID for the selected TIMB grade name
      const selectedGrade = timbGrades.find(g => g.name === timbGrade);
      if (!selectedGrade) {
        throw new Error(`TIMB Grade "${timbGrade}" not found locally. Please sync the app.`);
      }
      
      const timbGradeId = selectedGrade.id;

      await powersync.execute(
        'UPDATE receiving_bale SET timb_grade = ?, write_date = ? WHERE id = ?',
        [timbGradeId, new Date().toISOString(), baleData.id]
      );

      setSuccessMessage('TIMB Grade saved locally. It will be synced to the server.');
        
      // Clear barcode and reset state after successful save
      setTimeout(() => {
          resetState(); // Clear barcode and all state
          setSuccessMessage(null);
      }, 1500);

    } catch (e: any) {
        const errorMessage = e.message || 'An error occurred while saving the grade.';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView className="flex-1 p-4 bg-gray-100" contentContainerStyle={{ paddingBottom: 20 }}>
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
                <Combobox
                  value={timbGrade}
                  onChangeText={setTimbGrade}
                  placeholder="TIMB Grade (e.g., L1F)"
                  options={timbGrades}
                  displayField="name"
                  onSelect={(item) => setTimbGrade(item.name)}
                />
                
                <View className="mb-3" />
                
                <Text className="font-semibold text-gray-600 mb-1">Classifier Number</Text>
                <TextInput 
                  className="border border-gray-300 rounded-md p-2" 
                  placeholder="Classifier Number" 
                  autoCapitalize="characters"
                />
                
                <View className="mb-4" />
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
    </KeyboardAvoidingView>
  );
};

export default ClassificationScreen;
