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
import { WarehouseRecord, ProductRecord, InstructionRecord } from '@/powersync/Schema';

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

  // Search text states for type-to-search dropdowns
  const [sourceSearchText, setSourceSearchText] = useState('');
  const [destinationSearchText, setDestinationSearchText] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [instructionSearchText, setInstructionSearchText] = useState('');

  // Selected items for type-to-search dropdowns
  const [selectedSource, setSelectedSource] = useState<WarehouseRecord | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<WarehouseRecord | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<InstructionRecord | null>(null);

  // Focus states for dropdowns
  const [isSourceFocused, setIsSourceFocused] = useState(false);
  const [isDestinationFocused, setIsDestinationFocused] = useState(false);
  const [isProductFocused, setIsProductFocused] = useState(false);
  const [isInstructionFocused, setIsInstructionFocused] = useState(false);

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

  const getWarehouseDisplayName = (warehouse: WarehouseRecord | null): string => {
    if (!warehouse) return 'Not selected';
    const name = warehouse.name ?? `Warehouse ${warehouse.id}`;
    if (warehouse.warehouse_type) {
      const typeCapitalized =
        warehouse.warehouse_type.charAt(0).toUpperCase() +
        warehouse.warehouse_type.slice(1);
      return `${name} - ( ${typeCapitalized} )`;
    }
    return name;
  };

  // Handlers for source warehouse
  const handleSourceSelect = (warehouse: WarehouseRecord) => {
    setSelectedSource(warehouse);
    setSourceId(String(warehouse.id));
    setSourceSearchText(getWarehouseDisplayName(warehouse));
    setIsSourceFocused(false);
  };

  const handleSourceChange = (text: string) => {
    setSourceSearchText(text);
    if (selectedSource && text !== getWarehouseDisplayName(selectedSource)) {
      setSelectedSource(null);
      setSourceId('');
    }
  };

  // Handlers for destination warehouse
  const handleDestinationSelect = (warehouse: WarehouseRecord) => {
    setSelectedDestination(warehouse);
    setDestinationId(String(warehouse.id));
    setDestinationSearchText(getWarehouseDisplayName(warehouse));
    setIsDestinationFocused(false);
  };

  const handleDestinationChange = (text: string) => {
    setDestinationSearchText(text);
    if (selectedDestination && text !== getWarehouseDisplayName(selectedDestination)) {
      setSelectedDestination(null);
      setDestinationId('');
    }
  };

  // Handlers for product
  const handleProductSelect = (product: ProductRecord) => {
    setSelectedProduct(product);
    setProductId(String(product.id));
    setProductSearchText(product.name ?? `Product ${product.id}`);
    setIsProductFocused(false);
  };

  const handleProductChange = (text: string) => {
    setProductSearchText(text);
    if (selectedProduct && text !== (selectedProduct.name ?? `Product ${selectedProduct.id}`)) {
      setSelectedProduct(null);
      setProductId('');
    }
  };

  // Handlers for instruction
  const handleInstructionSelect = (instruction: InstructionRecord) => {
    setSelectedInstruction(instruction);
    setInstructionId(String(instruction.id));
    setInstructionSearchText(instruction.name ?? `Instruction ${instruction.id}`);
    setIsInstructionFocused(false);
  };

  const handleInstructionChange = (text: string) => {
    setInstructionSearchText(text);
    if (selectedInstruction && text !== (selectedInstruction.name ?? `Instruction ${selectedInstruction.id}`)) {
      setSelectedInstruction(null);
      setInstructionId('');
    }
  };

  // Get filtered instructions - show all posted instructions
  const getFilteredInstructions = (): InstructionRecord[] => {
    return instructions.filter((i: any) => 
      i.status === 'posted' && 
      i.is_exhausted === 0
    );
  };

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
                {destinations
                  .filter((d) =>
                    getWarehouseDisplayName(d)
                      .toLowerCase()
                      .includes(sourceSearchText.toLowerCase())
                  )
                  .slice(0, 25)
                  .map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      className="p-3 border-b border-gray-100 bg-white"
                      onPress={() => {
                        handleSourceSelect(d);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base text-gray-900">
                        {getWarehouseDisplayName(d)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {destinations.filter((d) =>
                  getWarehouseDisplayName(d)
                    .toLowerCase()
                    .includes(sourceSearchText.toLowerCase())
                ).length === 0 && (
                  <Text className="text-gray-500 text-center py-3">
                    No warehouses found.
                  </Text>
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
                {destinations
                  .filter((d) =>
                    getWarehouseDisplayName(d)
                      .toLowerCase()
                      .includes(destinationSearchText.toLowerCase())
                  )
                  .slice(0, 25)
                  .map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      className="p-3 border-b border-gray-100 bg-white"
                      onPress={() => {
                        handleDestinationSelect(d);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base text-gray-900">
                        {getWarehouseDisplayName(d)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {destinations.filter((d) =>
                  getWarehouseDisplayName(d)
                    .toLowerCase()
                    .includes(destinationSearchText.toLowerCase())
                ).length === 0 && (
                  <Text className="text-gray-500 text-center py-3">
                    No warehouses found.
                  </Text>
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
                  .filter((p) =>
                    (p.name ?? `Product ${p.id}`)
                      .toLowerCase()
                      .includes(productSearchText.toLowerCase())
                  )
                  .slice(0, 25)
                  .map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      className="p-3 border-b border-gray-100 bg-white"
                      onPress={() => {
                        handleProductSelect(p);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base text-gray-900">
                        {p.name ?? `Product ${p.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {products.filter((p) =>
                  (p.name ?? `Product ${p.id}`)
                    .toLowerCase()
                    .includes(productSearchText.toLowerCase())
                ).length === 0 && (
                  <Text className="text-gray-500 text-center py-3">
                    No products found.
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Shipment Instruction type-and-search */}
        <View className="mb-4">
          <Text className="text-gray-700 mb-1 font-semibold">Shipment Instruction</Text>
          <TextInput
            className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
            placeholder="Type to search shipment instruction..."
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
                {getFilteredInstructions()
                  .filter((i) =>
                    (i.name ?? `Instruction ${i.id}`)
                      .toLowerCase()
                      .includes(instructionSearchText.toLowerCase())
                  )
                  .slice(0, 25)
                  .map((i) => (
                    <TouchableOpacity
                      key={i.id}
                      className="p-3 border-b border-gray-100 bg-white"
                      onPress={() => {
                        handleInstructionSelect(i);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base text-gray-900">
                        {i.name ?? `Instruction ${i.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {getFilteredInstructions().filter((i) =>
                  (i.name ?? `Instruction ${i.id}`)
                    .toLowerCase()
                    .includes(instructionSearchText.toLowerCase())
                ).length === 0 && (
                  <Text className="text-gray-500 text-center py-3">
                    No instructions found.
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>

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
        <View className="mb-4 mt-2">
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
          className="bg-[#65435C] p-4 rounded-xl items-center justify-center mb-10 shadow-sm"
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
