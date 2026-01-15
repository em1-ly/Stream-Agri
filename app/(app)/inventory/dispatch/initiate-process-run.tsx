import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { Picker } from '@react-native-picker/picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { WarehouseRecord, ProductRecord } from '@/powersync/Schema';

type InstructionRecord = {
  id: string;
  name?: string;
  status?: string;
};

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

const InitiateProcessRunScreen = () => {
  const router = useRouter();

  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [productId, setProductId] = useState('');
  const [instructionId, setInstructionId] = useState('');

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [processRunWarehouses, setProcessRunWarehouses] = useState<WarehouseRecord[]>([]);
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
    const loadData = async () => {
      try {
        const [wh, prod, instr] = await Promise.all([
          powersync.getAll<WarehouseRecord>('SELECT * FROM warehouse_warehouse'),
          powersync.getAll<ProductRecord>('SELECT * FROM warehouse_product'),
          // Mirror of warehouse.instruction, filter out draft like the wizard domain
          powersync.getAll<InstructionRecord>(
            "SELECT id, name, status FROM warehouse_instruction WHERE status != 'draft'"
          ),
        ]);

        setWarehouses(wh);
        const processRun = wh.filter(w => w.warehouse_type === 'process_run');
        setProcessRunWarehouses(processRun);

        setProducts(prod);
        setInstructions(instr);

        // Default to the 'Green' product by name (configured in Odoo as warehouse product)
        const green = prod.find(
          (p) => typeof p.name === 'string' && p.name.toLowerCase() === 'green'
        );
        if (green) {
          setProductId(String(green.id));
        }
      } catch (error) {
        console.error('Failed to load process run dispatch data:', error);
        Alert.alert('Error', 'Could not load process run dispatch data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCreateProcessRunDispatch = async () => {
    if (!sourceId) {
      Alert.alert('Missing Information', 'Please select a source warehouse.');
      return;
    }
    if (!destinationId) {
      Alert.alert('Missing Information', 'Please select a destination  warehouse.');
      return;
    }
    if (!productId) {
      Alert.alert('Missing Information', 'Product is required.');
      return;
    }
    if (!instructionId) {
      Alert.alert('Missing Information', 'Shipping Instruction is mandatory for Process Run.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const localId = uuidv4();

      // Offline-first: create a local warehouse_dispatch_note row for process run dispatch.
      // PowerSync/Connector will later sync this via the warehouse_dispatch_create_note wizard.
      await powersync.execute(
        `INSERT INTO warehouse_dispatch_note (
          id,
          warehouse_source_id,
          warehouse_destination_id,
          product_id,
          instruction_id,
          transport_id,
          truck_reg_number,
          driver_name,
          driver_national_id,
          driver_cellphone,
          dispatch_type,
          state,
          create_date,
          write_date,
          mobile_app_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localId,
          Number(sourceId),
          Number(destinationId),
          Number(productId),
          instructionId ? Number(instructionId) : null,
          null,
          null,
          null,
          null,
          null,
          'bales',
          'draft',
          now,
          now,
          localId,
        ]
      );

      // Navigate immediately to the shared scan screen for process run.
      router.replace({
        pathname: '/(app)/inventory/dispatch/initiate-process-run-scan-bales',
        params: { dispatchNoteId: String(localId) },
      });
    } catch (error: any) {
      console.error('Process run dispatch create error', error);
      Alert.alert(
        'Error',
        error?.message || 'System error while creating process run dispatch note. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Initiate Process Run' }} />
        <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color="#65435C" />
          <Text className="text-lg text-[#65435C] mt-2">Loading...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Initiate Process Run', headerShown: true }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          className="flex-1 bg-white p-5"
          contentContainerStyle={{ 
            flexGrow: 1,
            paddingBottom: isKeyboardVisible ? 400 : 100 
          }}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <FormPicker
            label="Source Warehouse"
            value={sourceId}
            onValueChange={setSourceId}
            items={warehouses.map(w => ({
              label: w.name ? `${w.name}${w.warehouse_type ? ` - (${w.warehouse_type})` : ''}` : `Warehouse ${w.id}`,
              value: w.id
            }))}
            placeholder="Select source warehouse"
          />

          <FormPicker
            label="Destination Warehouse"
            value={destinationId}
            onValueChange={setDestinationId}
            items={processRunWarehouses.map(w => ({
              label: w.name ? `${w.name} - (process_run)` : `Warehouse ${w.id}`,
              value: w.id
            }))}
            placeholder="Select destination warehouse"
          />

          <FormPicker
            label="Product"
            value={productId}
            onValueChange={setProductId}
            items={products.map(p => ({
              label: p.name ?? `Product ${p.id}`,
              value: p.id
            }))}
            placeholder="Select product"
          />

          <FormPicker
            label="Instruction"
            value={instructionId}
            onValueChange={setInstructionId}
            items={instructions.map(instr => ({
              label: instr.name ?? `Instruction ${instr.id}`,
              value: instr.id
            }))}
            placeholder="Select instruction"
          />

          <TouchableOpacity
            onPress={handleCreateProcessRunDispatch}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Create &amp; Scan Products</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default InitiateProcessRunScreen;


