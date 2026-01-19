import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { WarehouseRecord, ProductRecord } from '@/powersync/Schema';

const FormReadonly = ({ label, value }: { label: string; value: string }) => (
    <View className="mb-4">
        <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
        <View className="bg-gray-100 border border-gray-300 rounded-lg p-3">
            <Text className="text-base text-[#111827]">{value}</Text>
        </View>
    </View>
);

const InitiateSatelliteScanScreen = () => {
  const router = useRouter();

  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  // Search text state for warehouse
  const [warehouseSearchText, setWarehouseSearchText] = useState('');
  const [isWarehouseFocused, setIsWarehouseFocused] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseRecord | null>(null);

  const [satelliteWarehouses, setSatelliteWarehouses] = useState<WarehouseRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
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
        const [wh, prod] = await Promise.all([
          powersync.getAll<WarehouseRecord>('SELECT * FROM warehouse_warehouse'),
          powersync.getAll<ProductRecord>('SELECT * FROM warehouse_product'),
        ]);

        // Only satellite warehouses, matching domain in wizard
        const satellites = wh.filter(w => w.warehouse_type === 'satellite');
        setSatelliteWarehouses(satellites);
        setProducts(prod);

        // Default to the 'Green' product by name (configured in Odoo as warehouse product)
        const green = prod.find(
          (p) => typeof p.name === 'string' && p.name.toLowerCase() === 'green'
        );
        if (green) {
          setProductId(String(green.id));
        }
      } catch (error) {
        console.error('Failed to load satellite dispatch data:', error);
        Alert.alert('Error', 'Could not load satellite dispatch data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleWarehouseSelect = async (warehouse: WarehouseRecord) => {
    setSelectedWarehouse(warehouse);
    const idStr = String(warehouse.id);
    setWarehouseId(idStr);
    const displayName = warehouse.name ? `${warehouse.name} - (satellite)` : `Warehouse ${warehouse.id}`;
    setWarehouseSearchText(displayName);
    setIsWarehouseFocused(false);
    setLocationId(null);
    setLocationName(null);

    try {
      // Match onchange_warehouse_source_id default location logic
      const defaultLocation = await powersync.getOptional<any>(
        'SELECT id, name FROM warehouse_location WHERE warehouse_id = ? AND default_location = 1',
        [idStr]
      );
      if (defaultLocation) {
        setLocationId(String(defaultLocation.id));

        // Build a display name similar to getLocationDisplayName in complete-receipt:
        // "<WarehouseName>/<LocationName>" where available.
        const parts: string[] = [];
        if (warehouse.name) {
          parts.push(warehouse.name);
        }
        if (defaultLocation.name) {
          parts.push(defaultLocation.name);
        }
        const displayName =
          parts.length > 0 ? parts.join('/') : String(defaultLocation.id);
        setLocationName(displayName);
      } else {
        setLocationId(null);
        setLocationName(null);
      }
    } catch (error) {
      console.error('Failed to load default location for satellite warehouse:', error);
    }
  };

  const handleWarehouseChange = (text: string) => {
    setWarehouseSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedWarehouse(null);
      setWarehouseId('');
      setLocationId(null);
      setLocationName(null);
    }
  };

  const handleStartSatelliteScan = () => {
    if (!warehouseId) {
      Alert.alert('Missing Information', 'Please select a source warehouse!');
      return;
    }
    if (!locationId) {
      Alert.alert('Missing Information', 'No default location found for this warehouse. Please configure a default location in Odoo.');
      return;
    }
    if (!productId) {
      Alert.alert('Missing Information', 'Green product is required.');
      return;
    }

    // Mirror action_open_scan_wizard: open scan wizard with defaults.
    // Once a dedicated satellite scan screen/route is added, update
    // this navigation to point there with these params.
    router.replace({
      pathname: '/(app)/inventory/dispatch/initiate-satellite-scan-bale',
      params: {
        warehouseId: String(warehouseId),
        locationId: String(locationId),
        productId: String(productId),
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Initiate Satellite Scan' }} />
        <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color="#65435C" />
          <Text className="text-lg text-[#65435C] mt-2">Loading...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Initiate Satellite Scan', headerShown: true }} />
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
          <Text className="text-xl font-bold text-[#65435C] mb-4">Start Satellite Dispatch Scan</Text>

          {/* Satellite Warehouse type-and-search */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Satellite Warehouse</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search satellite warehouse..."
              value={warehouseSearchText}
              onChangeText={handleWarehouseChange}
              onFocus={() => setIsWarehouseFocused(true)}
              onBlur={() => setTimeout(() => setIsWarehouseFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(isWarehouseFocused || (warehouseSearchText && warehouseSearchText.trim().length > 0 && !selectedWarehouse)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {satelliteWarehouses
                    .filter((w) => {
                      const displayName = w.name ? `${w.name} - (satellite)` : `Warehouse ${w.id}`;
                      return displayName.toLowerCase().includes(warehouseSearchText.toLowerCase());
                    })
                    .slice(0, 25)
                    .map((w) => {
                      const displayName = w.name ? `${w.name} - (satellite)` : `Warehouse ${w.id}`;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          className="p-3 border-b border-gray-100 bg-white"
                          onPress={() => {
                            handleWarehouseSelect(w);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-base text-gray-900">{displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {satelliteWarehouses.filter((w) => {
                    const displayName = w.name ? `${w.name} - (satellite)` : `Warehouse ${w.id}`;
                    return displayName.toLowerCase().includes(warehouseSearchText.toLowerCase());
                  }).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">No warehouses found.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          <FormReadonly 
            label="Location" 
            value={locationName || 'Location'} 
          />

          <FormReadonly 
            label="Product (Green)" 
            value={products.find(p => typeof p.name === 'string' && p.name.toLowerCase() === 'green')?.name || 'Green'} 
          />

          <TouchableOpacity
            onPress={handleStartSatelliteScan}
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

export default InitiateSatelliteScanScreen;



