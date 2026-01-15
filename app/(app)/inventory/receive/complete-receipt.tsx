import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
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
  const [warehousePickerVisible, setWarehousePickerVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

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
            }
          } else {
            setSelectedLocation(null);
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
      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 20 }}>
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
          <Text className="font-semibold text-gray-700 mb-1">Warehouse</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-lg p-3 mb-3 flex-row justify-between items-center bg-gray-50"
            onPress={() => setWarehousePickerVisible(true)}
          >
            <Text className="text-gray-900">
              {selectedWarehouse ? getWarehouseDisplayName(selectedWarehouse) : 'Select warehouse'}
            </Text>
          </TouchableOpacity>

          <Text className="font-semibold text-gray-700 mb-1">Location</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-lg p-3 mb-6 flex-row justify-between items-center bg-gray-50"
            onPress={() => {
              if (!selectedWarehouse) {
                Alert.alert('Select Warehouse', 'Please select a warehouse first.');
                return;
              }
              setLocationPickerVisible(true);
            }}
          >
            <Text className="text-gray-900">
              {selectedLocation ? getLocationDisplayName(selectedLocation, selectedWarehouse) : 'Select location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStartScanning}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Start Scanning</Text>
          </TouchableOpacity>
        </View>

        {/* Warehouse picker */}
        <Modal
          visible={warehousePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setWarehousePickerVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-2xl max-h-[60%] p-4">
              <Text className="text-lg font-bold text-[#65435C] mb-3">Select Warehouse</Text>
              <ScrollView>
                {warehouses.map((wh) => (
                  <TouchableOpacity
                    key={wh.id}
                    className="py-3 border-b border-gray-200"
                    onPress={() => {
                      setSelectedWarehouse(wh);
                      setWarehousePickerVisible(false);
                    }}
                  >
                    <Text className="text-base text-gray-900">
                      {getWarehouseDisplayName(wh)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {warehouses.length === 0 && (
                  <Text className="text-gray-500 text-center py-4">
                    No warehouses synced from Odoo yet.
                  </Text>
                )}
              </ScrollView>
              <TouchableOpacity
                className="mt-3 py-3 rounded-xl bg-gray-200 items-center"
                onPress={() => setWarehousePickerVisible(false)}
              >
                <Text className="text-gray-800 font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Location picker */}
        <Modal
          visible={locationPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setLocationPickerVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-2xl max-h-[60%] p-4">
              <Text className="text-lg font-bold text-[#65435C] mb-3">
                Select Location ({getWarehouseDisplayName(selectedWarehouse)})
              </Text>
              <ScrollView>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    className="py-3 border-b border-gray-200"
                    onPress={() => {
                      setSelectedLocation(loc);
                      setLocationPickerVisible(false);
                    }}
                  >
                    <Text className="text-base text-gray-900">
                      {getLocationDisplayName(loc, selectedWarehouse)}
                      {loc.default_location ? '  (Default)' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
                {locations.length === 0 && (
                  <Text className="text-gray-500 text-center py-4">
                    No locations found for this warehouse.
                  </Text>
                )}
              </ScrollView>
              <TouchableOpacity
                className="mt-3 py-3 rounded-xl bg-gray-200 items-center"
                onPress={() => setLocationPickerVisible(false)}
              >
                <Text className="text-gray-800 font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
};

export default CompleteReceiptScreen;


