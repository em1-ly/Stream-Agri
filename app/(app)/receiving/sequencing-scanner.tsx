import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
// Safe storage wrapper: falls back to in-memory store if native module is unavailable
let RNAsync: any = null;
try {
  // Use dynamic require to avoid initializing a missing native module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNAsync = require('@react-native-async-storage/async-storage').default;
} catch {}
const __memStore: Record<string, string> = {};
const SafeStorage = {
  async getItem(key: string) {
    try {
      if (RNAsync && typeof RNAsync.getItem === 'function') {
        return await RNAsync.getItem(key);
      }
    } catch {}
    return __memStore[key] ?? null;
  },
  async setItem(key: string, value: string) {
    try {
      if (RNAsync && typeof RNAsync.setItem === 'function') {
        return await RNAsync.setItem(key, value);
      }
    } catch {}
    __memStore[key] = value;
  }
};
import { Barcode, Search, CheckCircle, XCircle, ChevronLeft } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { powersync } from '@/powersync/system';
import { SellingPointRecord, FloorSaleRecord } from '@/powersync/Schema';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';


// Form components with proper TypeScript types
const FormInput = ({ label, value, onChangeText, placeholder }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) => (
    <View className="mb-4">
      <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
      <TextInput
        className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{ color: '#111827' }}
      />
    </View>
);
  
const FormPicker = ({ label, selectedValue, onValueChange, items }: {
  label: string;
  selectedValue: string | null;
  onValueChange: (value: string | null) => void;
  items: { id: any; name: string | null }[];
}) => (
      <View className="mb-4">
          <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
          <View className="bg-gray-200 border border-gray-300 rounded-lg">
              <Picker 
                selectedValue={selectedValue} 
                onValueChange={onValueChange}
                style={{ height: 50, color: selectedValue ? '#111827' : '#4B5563' }}
              >
                  <Picker.Item label={`-- Select ${label} --`} value={null} color="#9CA3AF" />
                  {items.map((item) => (
                      <Picker.Item key={String(item.id)} label={item.name || ''} value={String(item.id)} color="#374151" />
                  ))}
              </Picker>
          </View>
      </View>
);

const SequencingScannerScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const STORAGE_KEY = 'receiving:sequencingFormState';
  const [hasInitialized, setHasInitialized] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // --- Dropdown Data State ---
  const [sellingPoints, setSellingPoints] = useState<SellingPointRecord[]>([]);
  const [allFloorSales, setAllFloorSales] = useState<FloorSaleRecord[]>([]);
  const [filteredFloorSales, setFilteredFloorSales] = useState<FloorSaleRecord[]>([]);

  // --- Form State ---
  const [selectedSellingPoint, setSelectedSellingPoint] = useState<string | null>(null);
  const [selectedFloorSale, setSelectedFloorSale] = useState<string | null>(null);
  const [row, setRow] = useState('');
  const [rowMax, setRowMax] = useState<string>('');
  const [pendingRowBales, setPendingRowBales] = useState<string[]>([]);
  const [scaleBarcode, setScaleBarcode] = useState('');
  const [location, setLocation] = useState('');

  // --- UI State ---
  const [scanInfo, setScanInfo] = useState<{
    grower_number: string;
    grower_name: string;
    lot_number: string;
    group_number: string;
    total_delivered: number;
    total_scanned: number;
  } | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Listen for the scanned barcode parameter from the camera screen - FIXED VERSION
  useEffect(() => {
    if (params.scannedBarcode && params.scannedBarcode !== lastScannedBarcode) {
        const newBarcode = params.scannedBarcode as string;
        setScaleBarcode(newBarcode);
        setLastScannedBarcode(newBarcode);
        
        // Instead of trying to clear params (which causes issues), we'll use our own tracking
        // The barcode will be cleared when we process it or start new scanning
    }
  }, [params.scannedBarcode, lastScannedBarcode]);

  // Fetch data for dropdowns - runs only once on mount
  useEffect(() => {
    const fetchData = async () => {
        const spResult = await powersync.getAll<SellingPointRecord>('SELECT * FROM floor_maintenance_selling_point WHERE active = 1');
        const fsResult = await powersync.getAll<FloorSaleRecord>('SELECT * FROM floor_maintenance_floor_sale WHERE active = 1');
        setSellingPoints(spResult);
        setAllFloorSales(fsResult);
        
        // Restore persisted form state only on initial load
        if (!hasInitialized) {
          try {
            const raw = await SafeStorage.getItem(STORAGE_KEY);
            if (raw) {
              const saved = JSON.parse(raw);
              if (saved.selectedSellingPoint) setSelectedSellingPoint(saved.selectedSellingPoint);
              if (saved.selectedFloorSale) setSelectedFloorSale(saved.selectedFloorSale);
              if (saved.row) setRow(saved.row);
              if (saved.rowMax) setRowMax(saved.rowMax);
              if (typeof saved.location === 'string') setLocation(saved.location);
              if (Array.isArray(saved.pendingRowBales)) setPendingRowBales(saved.pendingRowBales);
            }
          } catch {}
          setHasInitialized(true);
        }
    };
    fetchData().catch(console.error);
  }, [hasInitialized]);

  // Persist form state whenever key fields change
  useEffect(() => {
    if (!hasInitialized) return;
    
    (async () => {
      try {
        await SafeStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ 
            selectedSellingPoint, 
            selectedFloorSale, 
            row, 
            rowMax, 
            location, 
            pendingRowBales 
          })
        );
      } catch {}
    })();
  }, [selectedSellingPoint, selectedFloorSale, row, rowMax, location, pendingRowBales, hasInitialized]);

  // Filter floor sales when a selling point is selected
  useEffect(() => {
    if (selectedSellingPoint) {
        const filtered = allFloorSales.filter(fs => fs.sale_point_id?.toString() === selectedSellingPoint);
        setFilteredFloorSales(filtered);
        
        // Only reset floor sale if the current selection is no longer valid
        if (selectedFloorSale) {
            const currentFloorSaleValid = filtered.some(fs => fs.id === selectedFloorSale);
            if (!currentFloorSaleValid) {
                setSelectedFloorSale(null);
            }
        }
    } else {
        setFilteredFloorSales([]);
        // Only reset floor sale if selling point is cleared
        if (selectedFloorSale) {
            setSelectedFloorSale(null);
        }
    }
  }, [selectedSellingPoint, allFloorSales, selectedFloorSale]);

  const handleProcessScannedBale = async () => {
    if (!selectedSellingPoint || !selectedFloorSale || !row) {
      Alert.alert('Missing Information', 'Please fill in Selling Point, Floor Sale and Row Number.');
      return;
    }
    if (!scaleBarcode) {
      Alert.alert('Missing Barcode', 'Scan or enter a bale barcode.');
      return;
    }
  
    setIsProcessing(true);
    try {
      const newRecord = {
        id: uuid(),
        scale_barcode: scaleBarcode,
        row: row,
        selling_point_id: selectedSellingPoint,
        floor_sale_id: selectedFloorSale,
        created_at: new Date().toISOString()
      };
  
      await powersync.execute(
        'INSERT INTO receiving_curverid_bale_sequencing_model (id, scale_barcode, row, selling_point_id, floor_sale_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newRecord.id, newRecord.scale_barcode, newRecord.row, newRecord.selling_point_id, newRecord.floor_sale_id, newRecord.created_at]
      );
  
      // Since we don't get immediate feedback from the server, we'll just show a success message
      // The UI can be updated based on local data if needed
      setResultMessage('Bale queued for sequencing successfully.');
      setIsError(false);
  
      // Clear barcode for next scan
      setScaleBarcode('');
      setLastScannedBarcode(null);
  
    } catch (error) {
      console.error('Sequencing scan error:', error);
      Alert.alert('Error', 'Failed to process bale scan');
      setResultMessage('Error processing scan');
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartScanning = async () => {
    if (!selectedSellingPoint || !selectedFloorSale || !row) {
      Alert.alert('Missing Information', 'Please fill in Selling Point, Floor Sale and Row Number before scanning.');
      return;
    }

    const maxNum = parseInt((rowMax || '').toString(), 10);
    if (maxNum > 0 && pendingRowBales.length >= maxNum) {
      Alert.alert('Row Complete', `You have scanned ${pendingRowBales.length}/${maxNum} bales for Row ${row}. This row is complete. Please start a new row or change the row number.`);
      return;
    }

    // Save current state (all fields except scaleBarcode which we want to clear for fresh scanning)
    try {
      await SafeStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ 
          selectedSellingPoint, 
          selectedFloorSale, 
          row, 
          rowMax, 
          location, 
          pendingRowBales
        })
      );
    } catch (error) {
      console.error('Error saving form state:', error);
    }
    
    // Clear the current barcode for fresh scanning session
    setScaleBarcode('');
    setLastScannedBarcode(null); // Reset our tracking
    
    // Navigate to scanner - all fields will be preserved
    router.replace({ 
      pathname: '/receiving/barcode-scanner', 
      params: { 
        returnTo: 'sequencing'
      } 
    });
  };
  
  const handleCheckGrower = async () => {
    Alert.alert('Check Grower', 'This feature will allow you to look up grower sequence details.');
  };

  const handleClearForm = async () => {
    // Clear only fields under Scan Bale section
    setRow('');
    setRowMax('');
    setScaleBarcode('');
    setLastScannedBarcode(null);
    setPendingRowBales([]);
    setResultMessage('');
    setScanInfo(null);

    // Persist keeping selling point, floor sale, and location
    try {
      await SafeStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedSellingPoint,
          selectedFloorSale,
          row: '',
          rowMax: '',
          location,
          pendingRowBales: []
        })
      );
    } catch {}
  };

  return (
    <SafeAreaView className="flex-1 bg-[#65435C]">
      <Stack.Screen
        options={{
          title: 'Sequencing Scanner',
          headerShown: false,
        }}
      />
      <View className="flex-1 p-4">
        {/* Custom header that routes back to Receiving menu */}
        <View className="flex-row items-center justify-between mb-2 bg-white rounded-2xl px-4 py-3">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() =>
              router.replace({
                pathname: '/receiving',
                params: { tab: 'menu' },
              })
            }
          >
            <ChevronLeft size={24} color="#65435C" />
            <Text className="text-[#65435C] font-bold text-lg ml-2">
              Sequencing Scanner
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 bg-white rounded-2xl p-5 mt-2">
          {/* Sale Configuration (sticky config fields that persist during scanning) */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-[#65435C]">Sale Configuration</Text>
              <TouchableOpacity onPress={handleClearForm} className="bg-red-500 px-3 py-1 rounded">
                <Text className="text-white text-sm">Clear</Text>
              </TouchableOpacity>
            </View>
            <FormPicker 
              label="Selling Point"
              selectedValue={selectedSellingPoint}
              onValueChange={(itemValue: string | null) => setSelectedSellingPoint(itemValue)}
              
              items={sellingPoints}
            />
            <FormPicker 
              label="Floor Sale"
              selectedValue={selectedFloorSale}
              onValueChange={(itemValue: string | null) => setSelectedFloorSale(itemValue)}
              items={filteredFloorSales}
            />
          </View>

          {/* Scanning Interface */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <TouchableOpacity 
              onPress={async () => {
                if (!selectedSellingPoint || !selectedFloorSale) {
                  Alert.alert('Missing Information', 'Please fill in Selling Point and Floor Sale before scanning.');
                  return;
                }

                // Navigate to scale-bale screen with the selected configuration
                try {
                  await SafeStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                      selectedSellingPoint,
                      selectedFloorSale,
                      row,
                      rowMax,
                      location,
                      pendingRowBales
                    })
                  );
                } catch (error) {
                  console.error('Error saving form state:', error);
                }
                
                // Navigate to scanner - all fields will be preserved
                router.push({ 
                  pathname: '/receiving/scale-bale', 
                  params: { 
                    rowMax: (rowMax || '').toString(),
                    row: (row || '').toString(),
                    selling_point_id: selectedSellingPoint || '',
                    floor_sale_id: selectedFloorSale || '',
                    reset: '1'
                  } 
                });
              }}
              className="bg-[#65435C] p-3 rounded-lg flex-row items-center justify-center mt-2"
            >
              <Barcode size={20} color="white" />
              <Text className="text-white font-bold ml-2">Start Scanning</Text>
            </TouchableOpacity>
          </View>

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
      </View>
    </SafeAreaView>
  );
};

export default SequencingScannerScreen;