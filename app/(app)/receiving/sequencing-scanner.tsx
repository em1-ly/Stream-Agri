import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Barcode, Search, CheckCircle, XCircle } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { powersync } from '@/powersync/system';
import { SellingPointRecord, FloorSaleRecord } from '@/powersync/Schema';

// ... (FormInput and FormPicker components remain the same) ...
const FormInput = ({ label, value, onChangeText, placeholder }) => (
    <View className="mb-4">
      <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
      <TextInput
        className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    </View>
);
  
const FormPicker = ({ label, selectedValue, onValueChange, items }) => (
      <View className="mb-4">
          <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
          <View className="bg-gray-100 border border-gray-300 rounded-lg">
              <Picker selectedValue={selectedValue} onValueChange={onValueChange}>
                  <Picker.Item label={`-- Select ${label} --`} value={null} />
                  {items.map((item) => (
                      <Picker.Item key={item.id} label={item.name} value={item.id} />
                  ))}
              </Picker>
          </View>
      </View>
);

const SequencingScannerScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Dropdown Data State ---
  const [sellingPoints, setSellingPoints] = useState<SellingPointRecord[]>([]);
  const [allFloorSales, setAllFloorSales] = useState<FloorSaleRecord[]>([]);
  const [filteredFloorSales, setFilteredFloorSales] = useState<FloorSaleRecord[]>([]);

  // --- Form State ---
  const [selectedSellingPoint, setSelectedSellingPoint] = useState<string | null>(null);
  const [selectedFloorSale, setSelectedFloorSale] = useState<string | null>(null);
  const [row, setRow] = useState('');
  const [scaleBarcode, setScaleBarcode] = useState('');

  // --- UI State ---
  const [scanInfo, setScanInfo] = useState(null);
  const [resultMessage, setResultMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Listen for the scanned barcode parameter from the camera screen
  useEffect(() => {
    if (params.scannedBarcode) {
        setScaleBarcode(params.scannedBarcode as string);
    }
  }, [params.scannedBarcode]);

  // Fetch data for dropdowns
  useEffect(() => {
    const fetchData = async () => {
        const spResult = await powersync.getAll<SellingPointRecord>('SELECT * FROM floor_maintenance_selling_point WHERE active = 1');
        const fsResult = await powersync.getAll<FloorSaleRecord>('SELECT * FROM floor_maintenance_floor_sale WHERE active = 1');
        setSellingPoints(spResult);
        setAllFloorSales(fsResult);
    };
    fetchData().catch(console.error);
  }, []);

  // Filter floor sales when a selling point is selected
  useEffect(() => {
    if (selectedSellingPoint) {
        const filtered = allFloorSales.filter(fs => fs.sale_point_id?.toString() === selectedSellingPoint);
        setFilteredFloorSales(filtered);
    } else {
        setFilteredFloorSales([]);
    }
    setSelectedFloorSale(null); // Reset floor sale selection
  }, [selectedSellingPoint, allFloorSales]);

  const handleProcessScannedBale = async () => {
    // This is the logic that was in "handleScanBale" before.
    // It is now separate from the navigation logic.
    if (!selectedSellingPoint || !selectedFloorSale || !row || !scaleBarcode) {
        Alert.alert('Missing Information', 'Please fill in all configuration and scan fields.');
        return;
    }
    setIsProcessing(true);
    // ... rest of the placeholder logic ...
    setTimeout(() => {
        if (scaleBarcode.includes('GOOD')) {
          setScanInfo({
            grower_number: 'V23456',
            grower_name: 'John Appleseed',
            lot_number: 'LOT-001',
            group_number: 'GRP-A',
            total_delivered: 10,
            total_scanned: 5,
          });
          setResultMessage('Bale scanned successfully and sequenced.');
          setIsError(false);
        } else {
          setResultMessage('Error: Bale barcode not found or already scanned.');
          setIsError(true);
        }
        setIsProcessing(false);
      }, 1500);
  };
  
  const handleCheckGrower = async () => {
    Alert.alert('Check Grower', 'This feature will allow you to look up grower sequence details.');
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Sequencing Scanner',
        headerTitleStyle: { fontSize: 20, fontWeight: 'bold', color: '#65435C' }
      }} />
      <ScrollView className="flex-1 bg-white p-5">
        
        {/* Sale Configuration */}
        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-xl font-bold text-[#65435C] mb-3">Sale Configuration</Text>
          <FormPicker 
            label="Selling Point"
            selectedValue={selectedSellingPoint}
            onValueChange={(itemValue) => setSelectedSellingPoint(itemValue)}
            items={sellingPoints}
          />
          <FormPicker 
            label="Floor Sale"
            selectedValue={selectedFloorSale}
            onValueChange={(itemValue) => setSelectedFloorSale(itemValue)}
            items={filteredFloorSales}
          />
        </View>

        {/* Scanning Interface */}
        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-xl font-bold text-[#65435C] mb-3">Scan Bale</Text>
          <FormInput label="Row Number" value={row} onChangeText={setRow} placeholder="Enter row number" />
          <FormInput label="Scale Barcode" value={scaleBarcode} onChangeText={setScaleBarcode} placeholder="Scan or type barcode" />
          
          <View className="flex-row justify-around mt-2">
            {/* THIS BUTTON NOW NAVIGATES TO THE CAMERA */}
            <TouchableOpacity 
              onPress={() => router.push('/(app)/receiving/barcode-scanner')} 
              className="bg-blue-600 p-3 rounded-lg flex-row items-center"
            >
              <Barcode size={20} color="white" />
              <Text className="text-white font-bold ml-2">Open Scanner</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCheckGrower} className="bg-gray-600 p-3 rounded-lg flex-row items-center">
              <Search size={20} color="white" />
              <Text className="text-white font-bold ml-2">Check Grower</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* You might want a button to manually trigger the processing after scanning */}
        <TouchableOpacity onPress={handleProcessScannedBale} disabled={isProcessing} className={`bg-green-600 p-3 rounded-lg flex-row items-center justify-center mb-4 ${isProcessing ? 'opacity-50' : ''}`}>
            {isProcessing ? <ActivityIndicator color="white" /> : <CheckCircle size={20} color="white" />}
            <Text className="text-white font-bold ml-2">Process Scanned Barcode</Text>
        </TouchableOpacity>

        {/* Results and Scan Info sections remain the same... */}
        {resultMessage && (
            <View className={`mb-6 p-4 rounded-lg flex-row items-center ${isError ? 'bg-red-100' : 'bg-green-100'}`}>
                {isError ? <XCircle size={24} color="red" /> : <CheckCircle size={24} color="green" />}
                <Text className={`ml-3 text-base ${isError ? 'text-red-800' : 'text-green-800'}`}>{resultMessage}</Text>
            </View>
        )}

        {scanInfo && (
          <View className="mb-6 p-4 bg-blue-50 rounded-lg">
            <Text className="text-xl font-bold text-blue-800 mb-3">Current Scan Info</Text>
            <Text className="text-base mb-1"><Text className="font-semibold">Grower:</Text> {scanInfo.grower_name} ({scanInfo.grower_number})</Text>
            <Text className="text-base mb-1"><Text className="font-semibold">Lot / Group:</Text> {scanInfo.lot_number} / {scanInfo.group_number}</Text>
            <Text className="text-base"><Text className="font-semibold">Bales Scanned:</Text> {scanInfo.total_scanned} of {scanInfo.total_delivered}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
};

export default SequencingScannerScreen;