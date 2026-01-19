import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { WarehouseRecord, ProductRecord } from '@/powersync/Schema';

type InstructionRecord = {
  id: string;
  name?: string;
  status?: string;
};

const InitiateProcessRunScreen = () => {
  const router = useRouter();

  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [productId, setProductId] = useState('');
  const [instructionId, setInstructionId] = useState('');

  // Search text states
  const [sourceSearchText, setSourceSearchText] = useState('');
  const [destinationSearchText, setDestinationSearchText] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [instructionSearchText, setInstructionSearchText] = useState('');

  // Focus states for dropdown visibility
  const [isSourceFocused, setIsSourceFocused] = useState(false);
  const [isDestinationFocused, setIsDestinationFocused] = useState(false);
  const [isProductFocused, setIsProductFocused] = useState(false);
  const [isInstructionFocused, setIsInstructionFocused] = useState(false);

  // Selected item states
  const [selectedSource, setSelectedSource] = useState<WarehouseRecord | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<WarehouseRecord | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<InstructionRecord | null>(null);

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
          setSelectedProduct(green);
          setProductSearchText(green.name ?? `Product ${green.id}`);
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

  // Handler functions for type-and-search
  const handleSourceSelect = (warehouse: WarehouseRecord) => {
    setSelectedSource(warehouse);
    setSourceId(String(warehouse.id));
    setSourceSearchText(warehouse.name ? `${warehouse.name}${warehouse.warehouse_type ? ` - (${warehouse.warehouse_type})` : ''}` : `Warehouse ${warehouse.id}`);
    setIsSourceFocused(false);
  };

  const handleSourceChange = (text: string) => {
    setSourceSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedSource(null);
      setSourceId('');
    }
  };

  const handleDestinationSelect = (warehouse: WarehouseRecord) => {
    setSelectedDestination(warehouse);
    setDestinationId(String(warehouse.id));
    setDestinationSearchText(warehouse.name ? `${warehouse.name} - (process_run)` : `Warehouse ${warehouse.id}`);
    setIsDestinationFocused(false);
  };

  const handleDestinationChange = (text: string) => {
    setDestinationSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedDestination(null);
      setDestinationId('');
    }
  };

  const handleProductSelect = (product: ProductRecord) => {
    setSelectedProduct(product);
    setProductId(String(product.id));
    setProductSearchText(product.name ?? `Product ${product.id}`);
    setIsProductFocused(false);
  };

  const handleProductChange = (text: string) => {
    setProductSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedProduct(null);
      setProductId('');
    }
  };

  const handleInstructionSelect = (instruction: InstructionRecord) => {
    setSelectedInstruction(instruction);
    setInstructionId(String(instruction.id));
    setInstructionSearchText(instruction.name ?? `Instruction ${instruction.id}`);
    setIsInstructionFocused(false);
  };

  const handleInstructionChange = (text: string) => {
    setInstructionSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedInstruction(null);
      setInstructionId('');
    }
  };

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
          {/* Source Warehouse type-and-search */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Source Warehouse</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search source warehouse..."
              value={sourceSearchText}
              onChangeText={handleSourceChange}
              onFocus={() => setIsSourceFocused(true)}
              onBlur={() => setTimeout(() => setIsSourceFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(isSourceFocused || (sourceSearchText && sourceSearchText.trim().length > 0 && !selectedSource)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {warehouses
                    .filter((w) => {
                      const displayName = w.name ? `${w.name}${w.warehouse_type ? ` - (${w.warehouse_type})` : ''}` : `Warehouse ${w.id}`;
                      return displayName.toLowerCase().includes(sourceSearchText.toLowerCase());
                    })
                    .slice(0, 25)
                    .map((w) => {
                      const displayName = w.name ? `${w.name}${w.warehouse_type ? ` - (${w.warehouse_type})` : ''}` : `Warehouse ${w.id}`;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => {
                            handleSourceSelect(w);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-base text-gray-900">{displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {warehouses.filter((w) => {
                    const displayName = w.name ? `${w.name}${w.warehouse_type ? ` - (${w.warehouse_type})` : ''}` : `Warehouse ${w.id}`;
                    return displayName.toLowerCase().includes(sourceSearchText.toLowerCase());
                  }).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">No warehouses found.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Destination Warehouse type-and-search */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Destination Warehouse</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search destination warehouse..."
              value={destinationSearchText}
              onChangeText={handleDestinationChange}
              onFocus={() => setIsDestinationFocused(true)}
              onBlur={() => setTimeout(() => setIsDestinationFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(isDestinationFocused || (destinationSearchText && destinationSearchText.trim().length > 0 && !selectedDestination)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {processRunWarehouses
                    .filter((w) => {
                      const displayName = w.name ? `${w.name} - (process_run)` : `Warehouse ${w.id}`;
                      return displayName.toLowerCase().includes(destinationSearchText.toLowerCase());
                    })
                    .slice(0, 25)
                    .map((w) => {
                      const displayName = w.name ? `${w.name} - (process_run)` : `Warehouse ${w.id}`;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => {
                            handleDestinationSelect(w);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-base text-gray-900">{displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {processRunWarehouses.filter((w) => {
                    const displayName = w.name ? `${w.name} - (process_run)` : `Warehouse ${w.id}`;
                    return displayName.toLowerCase().includes(destinationSearchText.toLowerCase());
                  }).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">No warehouses found.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Product type-and-search */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Product</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search product..."
              value={productSearchText}
              onChangeText={handleProductChange}
              onFocus={() => setIsProductFocused(true)}
              onBlur={() => setTimeout(() => setIsProductFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(isProductFocused || (productSearchText && productSearchText.trim().length > 0 && !selectedProduct)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {products
                    .filter((p) => {
                      const displayName = p.name ?? `Product ${p.id}`;
                      return displayName.toLowerCase().includes(productSearchText.toLowerCase());
                    })
                    .slice(0, 25)
                    .map((p) => {
                      const displayName = p.name ?? `Product ${p.id}`;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => {
                            handleProductSelect(p);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-base text-gray-900">{displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {products.filter((p) => {
                    const displayName = p.name ?? `Product ${p.id}`;
                    return displayName.toLowerCase().includes(productSearchText.toLowerCase());
                  }).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">No products found.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Instruction type-and-search */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Instruction</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search instruction..."
              value={instructionSearchText}
              onChangeText={handleInstructionChange}
              onFocus={() => setIsInstructionFocused(true)}
              onBlur={() => setTimeout(() => setIsInstructionFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(isInstructionFocused || (instructionSearchText && instructionSearchText.trim().length > 0 && !selectedInstruction)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {instructions
                    .filter((instr) => {
                      const displayName = instr.name ?? `Instruction ${instr.id}`;
                      return displayName.toLowerCase().includes(instructionSearchText.toLowerCase());
                    })
                    .slice(0, 25)
                    .map((instr) => {
                      const displayName = instr.name ?? `Instruction ${instr.id}`;
                      return (
                        <TouchableOpacity
                          key={instr.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => {
                            handleInstructionSelect(instr);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-base text-gray-900">{displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {instructions.filter((instr) => {
                    const displayName = instr.name ?? `Instruction ${instr.id}`;
                    return displayName.toLowerCase().includes(instructionSearchText.toLowerCase());
                  }).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">No instructions found.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

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


