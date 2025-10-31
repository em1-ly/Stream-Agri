import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
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
import { Barcode, Search, CheckCircle, XCircle } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { powersync } from '@/powersync/system';
import { SellingPointRecord, FloorSaleRecord } from '@/powersync/Schema';
import * as SecureStore from 'expo-secure-store';

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
      />
    </View>
);
  
const FormPicker = ({ label, selectedValue, onValueChange, items }: {
  label: string;
  selectedValue: string | null;
  onValueChange: (value: string | null) => void;
  items: { id: string; name: string }[];
}) => (
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
      // Call the integrated sequencing scan API
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      const base = (url: string | null) => !url ? '' : (url.startsWith('http') ? url : `https://${url}`);
      
      const response = await fetch(`${base(serverURL)}/api/fo/receiving/sequencing_scan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-FO-Token': token || '' 
        },
        body: JSON.stringify({
          params: {
            scale_barcode: scaleBarcode,
            row: row,
            selling_point_id: selectedSellingPoint,
            floor_sale_id: selectedFloorSale
          }
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        Alert.alert('Scan Failed', result.message || 'Failed to scan bale');
        setResultMessage(result.message || 'Scan failed');
        setIsError(true);
        return;
      }

      // Update UI with scan results
      setScanInfo({
        grower_number: result.bale_info.grower_number,
        grower_name: result.bale_info.grower_name,
        lot_number: result.bale_info.lot_number,
        group_number: result.bale_info.group_number,
        total_delivered: result.bale_info.total_delivered,
        total_scanned: result.bale_info.total_scanned,
      });

      setResultMessage(result.message);
      setIsError(false);

      // Clear barcode for next scan
      setScaleBarcode('');
      setLastScannedBarcode(null);

      // Show completion alert if delivery is completed
      if (result.delivery_completed) {
        Alert.alert(
          '🎉 Delivery Completed!', 
          `All ${result.bale_info.total_delivered} bales have been scanned. ${result.ticket_created ? 'Ticket printing batch created.' : ''}`
        );
      }

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
    <>
      <Stack.Screen options={{ title: 'Sequencing Scanner', headerShown: true }} />
      <ScrollView className="flex-1 bg-white p-5">
        
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
            className="bg-blue-600 p-3 rounded-lg flex-row items-center justify-center mt-2"
          >
            <Barcode size={20} color="white" />
            <Text className="text-white font-bold ml-2">Start Scanning</Text>
          </TouchableOpacity>
        </View>

        {/* Removed in-page Add and Continue. Handled in scale-bale screen */}

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