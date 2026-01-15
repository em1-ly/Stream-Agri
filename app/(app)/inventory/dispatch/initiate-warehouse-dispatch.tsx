import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';
import { WarehouseRecord, ProductRecord, InstructionRecord } from '@/powersync/Schema';
  
const FormPicker = ({ label, value, onValueChange, items, placeholder }: { label: string; value: string; onValueChange: (value: string) => void; items: Array<{label: string; value: any}>; placeholder: string; }) => (
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

const InitiateWarehouseDispatchScreen = () => {
  const router = useRouter();
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [productId, setProductId] = useState('');
  const [instructionId, setInstructionId] = useState('');
  const [dispatchType, setDispatchType] = useState<'bales' | 'pallets'>('bales');
  const [noTransport, setNoTransport] = useState(false);

  const [destinations, setDestinations] = useState<WarehouseRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [instructions, setInstructions] = useState<InstructionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wh, p, i] = await Promise.all([
          powersync.getAll<WarehouseRecord>('SELECT * FROM warehouse_warehouse'),
          powersync.getAll<ProductRecord>('SELECT * FROM warehouse_product'),
          powersync.getAll<InstructionRecord>('SELECT * FROM warehouse_instruction'),
        ]);
        setDestinations(wh);
        setProducts(p);
        setInstructions(i);
      } catch (error) {
        console.error('Failed to fetch dispatch form data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Reset instruction if product or destination changes and current instruction is no longer valid
    if (instructionId) {
      const isValid = instructions.some((i: any) => 
        String(i.id) === String(instructionId) &&
        i.status === 'posted' &&
        i.is_exhausted === 0 &&
        String(i.product_id) === String(productId) &&
        String(i.destination_warehouse_id) === String(destinationId)
      );
      if (!isValid) {
        setInstructionId('');
      }
    }
  }, [productId, destinationId, instructions, instructionId]);

  const handleCreateDispatch = async () => {
    Keyboard.dismiss();
    // Basic validation
    if (!sourceId || !destinationId || !productId) {
      Alert.alert('Missing Information', 'Please select source, destination and product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      // Load warehouse type for destination to check if instruction is required
      const destWh = await powersync.getOptional<any>(
        'SELECT warehouse_type FROM warehouse_warehouse WHERE id = ?',
        [String(destinationId)]
      );

      if (destWh?.warehouse_type === 'process_run' && !instructionId) {
        Alert.alert('Validation Error', 'Shipping Instruction is required for dispatches to Process Run warehouses.');
        setIsSubmitting(false);
        return;
      }

      const localId = uuidv4();

      await powersync.execute(
        `INSERT INTO warehouse_dispatch_note (
          id,
          warehouse_source_id,
          warehouse_destination_id,
          product_id,
          instruction_id,
          dispatch_type,
          state,
          create_date,
          write_date,
          mobile_app_id,
          no_transportation_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localId,
          Number(sourceId),
          Number(destinationId),
          Number(productId),
          instructionId ? Number(instructionId) : null,
          dispatchType,
          'draft',
          now,
          now,
          localId,
          noTransport ? 1 : 0,
        ]
      );

      // Navigate immediately to the scan screen using the local UUID.
      const routeParams: Record<string, any> = { dispatchNoteId: String(localId) };
      const pathname =
        dispatchType === 'pallets'
          ? '/(app)/inventory/dispatch/scan-pallets'
          : '/(app)/inventory/dispatch/scan-bales';

      router.replace({ pathname, params: routeParams });

    } catch (error: any) {
      console.error('Warehouse dispatch create error', error);
      const msg = error?.message || 'System error while creating dispatch note. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#65435C" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <ScrollView
        className="flex-1 bg-white p-5"
        contentContainerStyle={{ 
          flexGrow: 1,
          paddingBottom: isKeyboardVisible ? 200 : 100 
        }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        
        <FormPicker
          label="Source Warehouse"
          value={sourceId}
          onValueChange={setSourceId}
          items={destinations.map((d) => ({
            label: d.name
              ? `${d.name}${d.warehouse_type ? ` - (${d.warehouse_type})` : ''}`
              : `Warehouse ${d.id}`,
            value: d.id,
          }))}
          placeholder="Select source warehouse"
        />

        <FormPicker
          label="Destination Warehouse"
          value={destinationId}
          onValueChange={setDestinationId}
          items={destinations.map((d) => ({
            label: d.name
              ? `${d.name}${d.warehouse_type ? ` - (${d.warehouse_type})` : ''}`
              : `Warehouse ${d.id}`,
            value: d.id,
          }))}
          placeholder="Select destination warehouse"
        />

        <FormPicker
          label="Product"
          value={productId}
          onValueChange={setProductId}
          items={products.map((p) => ({ label: p.name ?? `Product ${p.id}`, value: p.id }))}
          placeholder="Select product"
        />

        <FormPicker
          label="Shipment Instruction"
          value={instructionId}
          onValueChange={setInstructionId}
          items={instructions
            .filter((i: any) => 
              i.status === 'posted' && 
              i.is_exhausted === 0 &&
              String(i.product_id) === String(productId) &&
              String(i.destination_warehouse_id) === String(destinationId)
            )
            .map((i) => ({ label: i.name ?? `Instruction ${i.id}`, value: i.id }))
          }
          placeholder={
            !productId || !destinationId 
              ? "Select Product & Destination first" 
              : "Select shipment instruction"
          }
        />

        {/* No Transport details toggle */}
        <TouchableOpacity 
          onPress={() => setNoTransport(!noTransport)}
          className="flex-row items-center mb-6 mt-2"
        >
          <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${noTransport ? 'bg-[#65435C] border-[#65435C]' : 'border-gray-300'}`}>
            {noTransport && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-gray-700 font-semibold">No Transportation Details</Text>
        </TouchableOpacity>

        {/* Dispatch type – radio style */}
        <View className="mb-6 mt-2">
          <Text className="text-gray-700 mb-3 font-semibold">Dispatch Type</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 py-3 px-3 rounded-xl border-2 ${
                dispatchType === 'bales'
                  ? 'bg-[#65435C] border-[#65435C]'
                  : 'bg-white border-gray-200'
              }`}
              onPress={() => setDispatchType('bales')}
            >
              <Text
                className={`text-center text-sm font-bold ${
                  dispatchType === 'bales' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Dispatch Products
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 px-3 rounded-xl border-2 ${
                dispatchType === 'pallets'
                  ? 'bg-[#65435C] border-[#65435C]'
                  : 'bg-white border-gray-200'
              }`}
              onPress={() => setDispatchType('pallets')}
            >
              <Text
                className={`text-center text-sm font-bold ${
                  dispatchType === 'pallets' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Dispatch Pallets
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCreateDispatch}
          className="bg-[#65435C] p-4 rounded-xl items-center justify-center mt-auto mb-10 shadow-sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Create & Start Scanning</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default function ScreenWrapper() {
  return (
    <>
      <Stack.Screen options={{ title: 'Initiate Dispatch', headerShown: true }} />
      <InitiateWarehouseDispatchScreen />
    </>
  );
}
