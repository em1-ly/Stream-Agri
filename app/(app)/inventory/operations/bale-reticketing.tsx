import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

type MessageType = 'info' | 'success' | 'error';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: any }>;
  placeholder: string;
}) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
    <View className="bg-gray-100 border border-gray-300 rounded-lg">
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        style={{ height: 50, color: value ? '#111827' : '#4B5563' }}
      >
        <Picker.Item label={placeholder} value="" color="#9CA3AF" />
        {items.map((item) => (
          <Picker.Item key={item.value} label={item.label} value={item.value} color="#374151" />
        ))}
      </Picker>
    </View>
  </View>
);

type BaleInfo = {
  id: string;
  barcode: string | null;
  logistics_barcode: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  location_id: number | null;
  location_name: string | null;
  product_id: number | null;
  product_name: string | null;
  grade: number | null;
  grade_name: string | null;
  mass: number | null;
  grower_number: string | null;
};

const BaleReticketingScreen = () => {
  const router = useRouter();
  const [logisticsBarcode, setLogisticsBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanTarget, setScanTarget] = useState<'logistics'>('logistics');

  const resetForm = () => {
    setLogisticsBarcode('');
    setMessage('');
    setMessageType('info');
  };

  const handleSearch = async () => {
    if (!logisticsBarcode) {
      Alert.alert('Missing logistics barcode', 'Please enter a logistics barcode.');
      return;
    }

    try {
      const bale = await powersync.getOptional<BaleInfo>(
        `SELECT b.id,
                b.barcode,
                b.logistics_barcode,
                b.warehouse_id,
                wh.name AS warehouse_name,
                b.location_id,
                loc.display_name AS location_name,
                b.product_id,
                prod.name AS product_name,
                b.grade,
                g.name AS grade_name,
                b.mass,
                b.grower_number
         FROM warehouse_shipped_bale b
         LEFT JOIN warehouse_warehouse wh ON wh.id = b.warehouse_id
         LEFT JOIN warehouse_location loc ON loc.id = b.location_id
         LEFT JOIN warehouse_product prod ON prod.id = b.product_id
         LEFT JOIN warehouse_bale_grade g ON g.id = b.grade
         WHERE b.logistics_barcode = ?
         LIMIT 1`,
        [logisticsBarcode]
      );

      if (!bale) {
        setMessage(`No bale found with logistics barcode '${logisticsBarcode}'.`);
        setMessageType('error');
        return;
      }

      // Navigate to detail screen with baleId and logistics barcode
      router.push({
        pathname: '/inventory/operations/bale-reticketing-detail',
        params: {
          baleId: bale.id,
          logisticsBarcode: bale.logistics_barcode || '',
        },
      });
    } catch (err: any) {
      console.error('Search bale error', err);
      setMessage(err?.message || 'Error searching for bale.');
      setMessageType('error');
    }
  };

  const messageBg =
    messageType === 'success'
      ? 'bg-green-100'
      : messageType === 'error'
      ? 'bg-red-100'
      : 'bg-blue-100';
  const messageText =
    messageType === 'success'
      ? 'text-green-800'
      : messageType === 'error'
      ? 'text-red-800'
      : 'text-blue-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Bale Reticketing', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            setScannerVisible(false);
            setLogisticsBarcode(code);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Logistics Barcode"
        />
      </Modal>
      <ScrollView className="flex-1 bg-white p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header card */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Bale Reticketing</Text>
          <Text className="text-base text-blue-900">
            Enter logistics barcode to find the bale, then set the new barcode.
          </Text>
        </View>

        {/* Logistics barcode input */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Logistics Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter logistics barcode..."
              value={logisticsBarcode}
              onChangeText={setLogisticsBarcode}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              onPress={() => {
                setScanTarget('logistics');
                setScannerVisible(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message area */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Buttons side by side */}
        <View className="mt-2 flex-row gap-3">
          <TouchableOpacity
            onPress={handleSearch}
            className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Search Bale</Text>
          </TouchableOpacity>
        <TouchableOpacity
          onPress={resetForm}
            className="flex-1 bg-gray-200 p-4 rounded-lg items-center justify-center"
        >
          <Text className="text-gray-800 font-semibold">Reset</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

export default BaleReticketingScreen;


