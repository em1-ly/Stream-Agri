import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import { powersync, setupPowerSync } from '@/powersync/system';
import { Stack, useRouter } from 'expo-router';

type Warehouse = {
  id: string;
  name?: string;
  code?: string;
  warehouse_type?: string;
};

type Location = {
  id: string;
  name?: string;
  warehouse_id?: string;
  default_location?: number;
};

const CompleteReceiptScreen = () => {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [warehouseSearchText, setWarehouseSearchText] = useState('');
  const [locationSearchText, setLocationSearchText] = useState('');
  const [isWarehouseFocused, setIsWarehouseFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);

  useEffect(() => {
    setupPowerSync();
    const whController = new AbortController();

    powersync.watch(
      `SELECT id, name, code, warehouse_type FROM warehouse_warehouse ORDER BY name`,
      [],
      {
        onResult: (result) => {
          const rows = (result.rows?._array || []) as Warehouse[];
          setWarehouses(rows);
        },
        onError: (err) => {
          console.error('Error loading warehouses:', err);
        },
      },
      { signal: whController.signal }
    );

    return () => {
      whController.abort();
    };
  }, []);

  useEffect(() => {
    const locController = new AbortController();

    if (!selectedWarehouse) {
      setLocations([]);
      setSelectedLocation(null);
      return () => locController.abort();
    }

    powersync.watch(
      `SELECT id, name, warehouse_id, default_location 
       FROM warehouse_location 
       WHERE warehouse_id = ? 
       ORDER BY default_location DESC, name`,
      [selectedWarehouse.id],
      {
        onResult: (result) => {
          const rows = (result.rows?._array || []) as Location[];
          setLocations(rows);
          if (rows.length) {
            const def = rows.find((l) => l.default_location) || rows[0];
            // If there is no selected location yet, or the current one
            // does not belong to this warehouse list, reset to default.
            if (!selectedLocation || !rows.some((l) => l.id === selectedLocation.id)) {
              setSelectedLocation(def);
              setLocationSearchText(getLocationDisplayName(def, selectedWarehouse));
            } else {
              // Update search text to match selected location
              setLocationSearchText(getLocationDisplayName(selectedLocation, selectedWarehouse));
            }
          } else {
            setSelectedLocation(null);
            setLocationSearchText('');
          }
        },
        onError: (err) => {
          console.error('Error loading locations:', err);
        },
      },
      { signal: locController.signal }
    );

    return () => locController.abort();
  }, [selectedWarehouse?.id]);

  const getWarehouseDisplayName = (warehouse: Warehouse | null): string => {
    if (!warehouse) return 'Not selected';
    const name = warehouse.name || warehouse.code || warehouse.id;
    if (warehouse.warehouse_type) {
      const typeCapitalized = warehouse.warehouse_type.charAt(0).toUpperCase() + warehouse.warehouse_type.slice(1);
      return `${name} - ( ${typeCapitalized} )`;
    }
    return name;
  };

  const getLocationDisplayName = (location: Location | null, warehouse: Warehouse | null): string => {
    if (!location) return 'Not selected';
    const parts: string[] = [];
    if (warehouse?.name) {
      parts.push(warehouse.name);
    }
    if (location.name) {
      parts.push(location.name);
    }
    return parts.length > 0 ? parts.join('/') : location.id;
  };

  // Handlers for warehouse
  const handleWarehouseSelect = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseSearchText(getWarehouseDisplayName(warehouse));
    setIsWarehouseFocused(false);
  };

  const handleWarehouseChange = (text: string) => {
    setWarehouseSearchText(text);
    if (selectedWarehouse && text !== getWarehouseDisplayName(selectedWarehouse)) {
      setSelectedWarehouse(null);
      setSelectedLocation(null);
      setLocationSearchText('');
    }
  };

  // Handlers for location
  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    setLocationSearchText(getLocationDisplayName(location, selectedWarehouse));
    setIsLocationFocused(false);
  };

  const handleLocationChange = (text: string) => {
    setLocationSearchText(text);
    if (selectedLocation && text !== getLocationDisplayName(selectedLocation, selectedWarehouse)) {
      setSelectedLocation(null);
    }
  };

  const handleStartScanning = () => {
    if (!selectedWarehouse || !selectedLocation) {
      Alert.alert('Missing Info', 'Please select both Warehouse and Location before starting scanning.');
      return;
    }

    router.push({
      pathname: '/(app)/inventory/receive/warehouse-bale-scan',
      params: {
        warehouseId: selectedWarehouse.id,
        locationId: selectedLocation.id,
        warehouseName: getWarehouseDisplayName(selectedWarehouse),
        locationName: getLocationDisplayName(selectedLocation, selectedWarehouse),
      },
    });
  };

  return (
    <>
    <Stack.Screen options={{ title: 'Complete Receipt', headerShown: true }} />
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        className="flex-1 p-5" 
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header card – styled similar to Odoo wizard */}
        <View className="p-4 bg-[#e6f4ff] rounded-lg border border-[#b3ddff] mb-4">
          <Text className="text-lg font-bold text-[#003366] mb-2">
            Complete Receipt
          </Text>
          <View className="flex-col">
            <Text className="text-base font-semibold text-[#003366]">
              Warehouse:{' '}
              <Text className="font-normal">
                {getWarehouseDisplayName(selectedWarehouse)}
              </Text>
            </Text>
            <Text className="text-base font-semibold text-[#003366] mt-1">
              Location:{' '}
              <Text className="font-normal">
                {getLocationDisplayName(selectedLocation, selectedWarehouse)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Body card – inputs & action, styled similar to other screens */}
        <View className="bg-white rounded-lg border border-gray-200 p-4">
          {/* Warehouse type-and-search */}
          <View className="mb-4">
          <Text className="font-semibold text-gray-700 mb-1">Warehouse</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder="Type to search warehouse..."
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
                  {warehouses
                    .filter((wh) =>
                      getWarehouseDisplayName(wh)
                        .toLowerCase()
                        .includes(warehouseSearchText.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((wh) => (
                  <TouchableOpacity
                    key={wh.id}
                        className="p-3 border-b border-gray-100 bg-white"
                    onPress={() => {
                          handleWarehouseSelect(wh);
                          Keyboard.dismiss();
                    }}
                        activeOpacity={0.7}
                  >
                    <Text className="text-base text-gray-900">
                      {getWarehouseDisplayName(wh)}
                    </Text>
                  </TouchableOpacity>
                ))}
                  {warehouses.filter((wh) =>
                    getWarehouseDisplayName(wh)
                      .toLowerCase()
                      .includes(warehouseSearchText.toLowerCase())
                  ).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">
                      No warehouses found.
                  </Text>
                )}
              </ScrollView>
            </View>
            )}
          </View>

          {/* Location type-and-search */}
          <View className="mb-6">
            <Text className="font-semibold text-gray-700 mb-1">Location</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              placeholder={selectedWarehouse ? "Type to search location..." : "Select warehouse first"}
              value={locationSearchText}
              onChangeText={handleLocationChange}
              onFocus={() => {
                if (!selectedWarehouse) {
                  Alert.alert('Select Warehouse', 'Please select a warehouse first.');
                  return;
                }
                setIsLocationFocused(true);
              }}
              onBlur={() => setTimeout(() => setIsLocationFocused(false), 100)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!!selectedWarehouse}
            />
            {selectedWarehouse && (isLocationFocused || (locationSearchText && locationSearchText.trim().length > 0 && !selectedLocation)) && (
              <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                <ScrollView 
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {locations
                    .filter((loc) =>
                      getLocationDisplayName(loc, selectedWarehouse)
                        .toLowerCase()
                        .includes(locationSearchText.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                        className="p-3 border-b border-gray-100 bg-white"
                    onPress={() => {
                          handleLocationSelect(loc);
                          Keyboard.dismiss();
                    }}
                        activeOpacity={0.7}
                  >
                    <Text className="text-base text-gray-900">
                      {getLocationDisplayName(loc, selectedWarehouse)}
                      {loc.default_location ? '  (Default)' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
                  {locations.filter((loc) =>
                    getLocationDisplayName(loc, selectedWarehouse)
                      .toLowerCase()
                      .includes(locationSearchText.toLowerCase())
                  ).length === 0 && (
                    <Text className="text-gray-500 text-center py-3">
                      No locations found.
                  </Text>
                )}
              </ScrollView>
              </View>
            )}
          </View>

              <TouchableOpacity
            onPress={handleStartScanning}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
              >
            <Text className="text-white font-bold text-lg">Start Scanning</Text>
              </TouchableOpacity>
            </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
};

export default CompleteReceiptScreen;


