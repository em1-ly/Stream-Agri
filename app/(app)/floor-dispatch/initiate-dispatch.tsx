import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { WarehouseRecord, ProductRecord, TransportRecord, DriverRecord } from '@/powersync/Schema';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  returnKeyType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go' | 'send';
  editable?: boolean;
}) => (
    <View className="mb-4">
      <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
      <TextInput
        className={`border border-gray-300 rounded-lg p-3 text-base ${editable ? 'bg-gray-100' : 'bg-gray-200'}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{ color: '#111827' }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        editable={editable}
      />
    </View>
);

const InitiateDispatchScreen = () => {
  const router = useRouter();
  
  // Form values
  const [destinationId, setDestinationId] = useState('');
  const [productId, setProductId] = useState('');
  const [transportId, setTransportId] = useState('');
  const [newTransportName, setNewTransportName] = useState('');
  const [truckReg, setTruckReg] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAddingNewDriver, setIsAddingNewDriver] = useState(false);
  const [isAddingNewTransporter, setIsAddingNewTransporter] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverNationalId, setDriverNationalId] = useState('');
  const [driverCellphone, setDriverCellphone] = useState('');
  const [noTransport, setNoTransport] = useState(false);

  // Data arrays
  const [destinations, setDestinations] = useState<WarehouseRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Search text states for type-to-search dropdowns
  const [destinationSearchText, setDestinationSearchText] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [transportSearchText, setTransportSearchText] = useState('');
  const [driverSearchText, setDriverSearchText] = useState('');

  // Selected items for type-to-search dropdowns
  const [selectedDestination, setSelectedDestination] = useState<WarehouseRecord | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<TransportRecord | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null);

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

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wh, p, t, d] = await Promise.all([
          powersync.getAll<WarehouseRecord>('SELECT * FROM warehouse_warehouse'),
          powersync.getAll<ProductRecord>('SELECT * FROM warehouse_product'),
          powersync.getAll<TransportRecord>('SELECT * FROM warehouse_transport'),
          powersync.getAll<DriverRecord>('SELECT * FROM warehouse_driver ORDER BY name ASC'),
        ]);
        setDestinations(wh);
        setProducts(p);
        setTransports(t);
        setDrivers(d);
      } catch (error) {
        console.error('Failed to fetch dispatch form data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handlers for destination
  const handleDestinationSelect = (warehouse: WarehouseRecord) => {
    setSelectedDestination(warehouse);
    setDestinationId(String(warehouse.id));
    setDestinationSearchText(getWarehouseDisplayName(warehouse));
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
  };

  const handleProductChange = (text: string) => {
    setProductSearchText(text);
    if (selectedProduct && text !== (selectedProduct.name ?? `Product ${selectedProduct.id}`)) {
      setSelectedProduct(null);
      setProductId('');
    }
  };

  // Handlers for transport
  const handleTransportSelect = (transport: TransportRecord) => {
    setSelectedTransport(transport);
    setTransportId(String(transport.id));
    setTransportSearchText(transport.name ?? `Transport ${transport.id}`);
    setIsAddingNewTransporter(false);
    setNewTransportName('');
  };

  const handleTransportChange = (text: string) => {
    setTransportSearchText(text);
    if (text.trim().toLowerCase() === '+ add new transporter' || text.trim().toLowerCase() === 'add new') {
      setIsAddingNewTransporter(true);
      setSelectedTransport(null);
      setTransportId('');
      setNewTransportName('');
      setTransportSearchText('');
      return;
    }
    if (selectedTransport && text !== (selectedTransport.name ?? `Transport ${selectedTransport.id}`)) {
      setSelectedTransport(null);
      setTransportId('');
      setIsAddingNewTransporter(false);
    }
  };

  // Handlers for driver
  const handleDriverSelect = (driver: DriverRecord) => {
    setSelectedDriver(driver);
    setSelectedDriverId(String(driver.id));
    setDriverSearchText(driver.name || `Driver ${driver.id}`);
    setDriverName(driver.name || '');
    setDriverNationalId(driver.national_id || '');
    setDriverCellphone(driver.cellphone || '');
    setIsAddingNewDriver(false);
  };

  const handleDriverChange = (text: string) => {
    setDriverSearchText(text);
    if (text.trim().toLowerCase() === '+ add new driver' || text.trim().toLowerCase() === 'add new') {
      setIsAddingNewDriver(true);
      setSelectedDriver(null);
      setSelectedDriverId('');
      setDriverName('');
      setDriverNationalId('');
      setDriverCellphone('');
      setDriverSearchText('');
      return;
    }
    if (selectedDriver && text !== (selectedDriver.name || `Driver ${selectedDriver.id}`)) {
      setSelectedDriver(null);
      setSelectedDriverId('');
    setIsAddingNewDriver(false);
    }
  };

  const handleCreateDispatch = async () => {
    Keyboard.dismiss();
    // Basic validation
    if (!destinationId || !productId) {
      Alert.alert('Error', 'Please select a destination and a product.');
      return;
    }
    
    // Resolve transport ID - use new transport name if adding new, otherwise use selected transport ID
    let effectiveTransportId = transportId;
    if (isAddingNewTransporter && newTransportName.trim()) {
      effectiveTransportId = newTransportName.trim();
    } else if (!transportId && transportSearchText && !isAddingNewTransporter) {
      // Try to find transport by name if ID not set but search text exists
      const foundTransport = transports.find(t => 
        (t.name ?? `Transport ${t.id}`).toLowerCase() === transportSearchText.toLowerCase()
      );
      if (foundTransport) {
        effectiveTransportId = String(foundTransport.id);
      }
    }
    
    if (!noTransport && (!effectiveTransportId || !truckReg || !driverName || !driverNationalId || !driverCellphone)) {
      Alert.alert('Error', 'Please fill in all transportation details or check "No Transportation Details".');
      return;
    }

    setIsCreating(true);
    try {
      const defaultSellingPoint = await powersync.get<any>("SELECT id FROM floor_maintenance_selling_point WHERE `default` = 1 LIMIT 1");
      
      const newDispatchId = uuidv4();
      const now = new Date().toISOString();
      let finalTransportId = transportId;
      let finalDriverId = selectedDriverId;

      // Create New Transporter if needed
      if (!noTransport && isAddingNewTransporter && newTransportName.trim()) {
        const newTransLocalId = uuidv4();
        await powersync.execute(
          'INSERT INTO warehouse_transport (id, name, active, create_date, write_date) VALUES (?, ?, 1, ?, ?)',
          [newTransLocalId, newTransportName.trim(), now, now]
        );
        finalTransportId = newTransLocalId;
      }

      // Create New Driver if needed
      if (!noTransport && isAddingNewDriver && driverName.trim()) {
        const newDriverLocalId = uuidv4();
        await powersync.execute(
          `INSERT INTO warehouse_driver (
            id, name, national_id, cellphone, active, create_date, write_date
          ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [
            newDriverLocalId,
            driverName.trim(),
            driverNationalId.toUpperCase(),
            driverCellphone,
            now,
            now
          ]
        );
        finalDriverId = newDriverLocalId;
      }

      const destinationIdValue = destinationId ? Number(destinationId) : null;
      const productIdValue = productId ? Number(productId) : null;
      const transportIdValue = !noTransport && finalTransportId ? finalTransportId : null;
      const driverIdValue = !noTransport && finalDriverId ? finalDriverId : null;

      await powersync.execute(
        `INSERT INTO floor_dispatch_note (id, mobile_app_id, origin_id, warehouse_destination_id, transport_id, product_id, truck_reg_number, driver_id, driver_name, driver_national_id, driver_cellphone, state, create_date, write_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newDispatchId,
          newDispatchId,
          defaultSellingPoint?.id,
          destinationIdValue,
          transportIdValue,
          productIdValue,
          noTransport ? null : truckReg.toUpperCase(),
          driverIdValue,
          noTransport ? null : driverName.trim(),
          noTransport ? null : driverNationalId.toUpperCase(),
          noTransport ? null : driverCellphone,
          'draft',
          now,
          now,
        ]
      );

      Alert.alert('Success', 'Dispatch note created.');
      router.replace({ pathname: '/(app)/floor-dispatch/scan-bales', params: { dispatchNoteId: newDispatchId } });

    } catch (error) {
      console.error('Failed to create dispatch note:', error);
      Alert.alert('Error', 'Failed to create dispatch note. Please try again.');
    } finally {
      setIsCreating(false);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        className="flex-1 bg-white p-5"
        contentContainerStyle={isKeyboardVisible ? {
          paddingBottom: 400
        } : {
          paddingBottom: 40
        }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Destination Warehouse */}
        <View className="mb-4">
          <Text className="text-gray-700 mb-1 font-semibold">Destination Warehouse</Text>
          <TextInput
            className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
            placeholder="Type to search destination warehouse..."
            value={destinationSearchText}
            onChangeText={handleDestinationChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {destinationSearchText && typeof destinationSearchText === 'string' && destinationSearchText.trim().length > 0 && !selectedDestination && (
            <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
              <ScrollView keyboardShouldPersistTaps="handled">
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
                      onPress={() => handleDestinationSelect(d)}
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

        {/* Product */}
        <View className="mb-4">
          <Text className="text-gray-700 mb-1 font-semibold">Product</Text>
          <TextInput
            className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
            placeholderTextColor="#9CA3AF"
            style={{ color: '#111827' }}
          placeholder="Type to search product..."
            value={productSearchText}
            onChangeText={handleProductChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {productSearchText && typeof productSearchText === 'string' && productSearchText.trim().length > 0 && !selectedProduct && (
            <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
              <ScrollView keyboardShouldPersistTaps="handled">
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
                      onPress={() => handleProductSelect(p)}
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
        
        <View className="flex-row items-center mb-4">
          <Text className="text-gray-700 font-semibold mr-3">No Transportation Details</Text>
          <Switch value={noTransport} onValueChange={setNoTransport} />
        </View>

        {!noTransport && (
          <>
            {/* Transport Name */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-1 font-semibold">Transport Name</Text>
              <TextInput
                className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                placeholder={isAddingNewTransporter ? "Enter new transporter name..." : "Type to search transport or type 'Add New'..."}
                value={isAddingNewTransporter ? newTransportName : transportSearchText}
                onChangeText={(text) => {
                  if (isAddingNewTransporter) {
                    setNewTransportName(text);
                  } else {
                    handleTransportChange(text);
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!isAddingNewTransporter && transportSearchText && typeof transportSearchText === 'string' && transportSearchText.trim().length > 0 && !selectedTransport && (
                <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      className="p-3 border-b border-gray-100 bg-blue-50"
                      onPress={() => {
                        setIsAddingNewTransporter(true);
                        setSelectedTransport(null);
                        setTransportId('');
                        setTransportSearchText('');
                        setNewTransportName('');
                      }}
                    >
                      <Text className="text-base text-blue-600 font-semibold">
                        + Add New Transporter
                      </Text>
                    </TouchableOpacity>
                    {transports
                      .filter((t) =>
                        (t.name ?? `Transport ${t.id}`)
                          .toLowerCase()
                          .includes(transportSearchText.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => handleTransportSelect(t)}
                        >
                          <Text className="text-base text-gray-900">
                            {t.name ?? `Transport ${t.id}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    {transports.filter((t) =>
                      (t.name ?? `Transport ${t.id}`)
                        .toLowerCase()
                        .includes(transportSearchText.toLowerCase())
                    ).length === 0 && (
                      <Text className="text-gray-500 text-center py-3">
                        No transports found.
                      </Text>
                    )}
                  </ScrollView>
                </View>
            )}
            </View>

            <FormInput label="Truck Reg Number" value={truckReg} onChangeText={setTruckReg} placeholder="Enter truck registration" />
            
            {/* Driver */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-1 font-semibold">Driver</Text>
              <TextInput
                className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                placeholder={isAddingNewDriver ? "Enter driver's name..." : "Type to search driver or type 'Add New'..."}
                value={isAddingNewDriver ? driverName : driverSearchText}
                onChangeText={(text) => {
                  if (isAddingNewDriver) {
                    setDriverName(text);
                  } else {
                    handleDriverChange(text);
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!isAddingNewDriver && driverSearchText && typeof driverSearchText === 'string' && driverSearchText.trim().length > 0 && !selectedDriver && (
                <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      className="p-3 border-b border-gray-100 bg-blue-50"
                      onPress={() => {
                        setIsAddingNewDriver(true);
                        setSelectedDriver(null);
                        setSelectedDriverId('');
                        setDriverName('');
                        setDriverNationalId('');
                        setDriverCellphone('');
                        setDriverSearchText('');
                      }}
                    >
                      <Text className="text-base text-blue-600 font-semibold">
                        + Add New Driver
                      </Text>
                    </TouchableOpacity>
                    {drivers
                      .filter((d) =>
                        (d.name || `Driver ${d.id}`)
                          .toLowerCase()
                          .includes(driverSearchText.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => handleDriverSelect(d)}
                        >
                          <Text className="text-base text-gray-900">
                            {d.name || `Driver ${d.id}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    {drivers.filter((d) =>
                      (d.name || `Driver ${d.id}`)
                        .toLowerCase()
                        .includes(driverSearchText.toLowerCase())
                    ).length === 0 && (
                      <Text className="text-gray-500 text-center py-3">
                        No drivers found.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
            
            <FormInput 
              label="Driver Name" 
              value={driverName} 
              onChangeText={setDriverName} 
              placeholder="Enter driver's name" 
              editable={isAddingNewDriver} 
            />
            
            <FormInput 
              label="Driver National ID" 
              value={driverNationalId} 
              onChangeText={setDriverNationalId} 
              placeholder="Enter driver's national ID" 
              editable={isAddingNewDriver} 
            />
            
            <FormInput
              label="Driver Cellphone"
              value={driverCellphone}
              onChangeText={setDriverCellphone}
              placeholder="Enter driver's cellphone"
              editable={isAddingNewDriver}
              onSubmitEditing={handleCreateDispatch}
              returnKeyType="done"
            />
          </>
        )}

        <TouchableOpacity
          onPress={handleCreateDispatch}
          className="bg-[#65435C] p-4 rounded-lg items-center justify-center mt-4"
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Create & Add Bales</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default InitiateDispatchScreen;

