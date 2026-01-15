import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { Picker } from '@react-native-picker/picker';
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

const InitiateDispatchScreen = () => {
  const router = useRouter();
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

  const [destinations, setDestinations] = useState<WarehouseRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  const handleDriverChange = (val: string) => {
    if (val === 'NEW_DRIVER') {
      setIsAddingNewDriver(true);
      setSelectedDriverId('');
      setDriverName('');
      setDriverNationalId('');
      setDriverCellphone('');
      return;
    }
    
    setIsAddingNewDriver(false);
    setSelectedDriverId(val);
    const driver = drivers.find(d => String(d.id) === val);
    if (driver) {
      setDriverName(driver.name || '');
      setDriverNationalId(driver.national_id || '');
      setDriverCellphone(driver.cellphone || '');
    } else {
      setDriverName('');
      setDriverNationalId('');
      setDriverCellphone('');
    }
  };

  const handleTransportChange = (val: string) => {
    if (val === 'NEW_TRANSPORTER') {
      setIsAddingNewTransporter(true);
      setTransportId('');
      setNewTransportName('');
      return;
    }
    setIsAddingNewTransporter(false);
    setTransportId(val);
  };

  const handleCreateDispatch = async () => {
    Keyboard.dismiss();
    // Basic validation
    if (!destinationId || !productId) {
      Alert.alert('Error', 'Please select a destination and a product.');
      return;
    }
    const effectiveTransportId = isAddingNewTransporter ? newTransportName.trim() : transportId;
    
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
        <FormPicker
          label="Destination Warehouse"
          value={destinationId}
          onValueChange={setDestinationId}
          items={destinations.map(d => ({
            label: getWarehouseDisplayName(d),
            value: d.id,
          }))}
          placeholder="Select destination"
        />
        <FormPicker
          label="Product"
          value={productId}
          onValueChange={setProductId}
          items={products.map(p => ({ label: p.name ?? `Product ${p.id}`, value: p.id }))}
          placeholder="Select product"
        />
        
        <View className="flex-row items-center mb-4">
          <Text className="text-gray-700 font-semibold mr-3">No Transportation Details</Text>
          <Switch value={noTransport} onValueChange={setNoTransport} />
        </View>

        {!noTransport && (
          <>
            <FormPicker
              label="Transport Name"
              value={isAddingNewTransporter ? 'NEW_TRANSPORTER' : transportId}
              onValueChange={handleTransportChange}
              items={[
                { label: '+ Add New Transporter', value: 'NEW_TRANSPORTER' },
                ...transports.map(t => ({ label: t.name ?? `Transport ${t.id}`, value: String(t.id) }))
              ]}
              placeholder="Select transport"
            />
            
            {isAddingNewTransporter && (
              <FormInput 
                label="New Transporter Name" 
                value={newTransportName} 
                onChangeText={setNewTransportName} 
                placeholder="Enter new transporter name" 
              />
            )}

            <FormInput label="Truck Reg Number" value={truckReg} onChangeText={setTruckReg} placeholder="Enter truck registration" />
            
            <FormPicker
              label="Driver"
              value={isAddingNewDriver ? 'NEW_DRIVER' : selectedDriverId}
              onValueChange={handleDriverChange}
              items={[
                { label: '+ Add New Driver', value: 'NEW_DRIVER' },
                ...drivers.map(d => ({ label: d.name || `Driver ${d.id}`, value: String(d.id) }))
              ]}
              placeholder="Select driver"
            />
            
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

