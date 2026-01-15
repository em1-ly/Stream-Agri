import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { FlashList } from '@shopify/flash-list';
import { Search } from 'lucide-react-native';

type DataCapture = {
  id: string;
  barcode?: string;
  product_id?: number;
  product_name?: string;
  grade?: number;
  grade_name?: string;
  mass?: number;
  price?: number;
  operation_no?: string;
  tobacco_type?: string;
  pickings_weight?: number;
  amount?: number;
  existing_bale_id?: number;
  create_date?: string;
};

const DataCapturingRecordsScreen = () => {
  const router = useRouter();
  const [records, setRecords] = useState<DataCapture[]>([]);
  const [filtered, setFiltered] = useState<DataCapture[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    powersync.watch(
      `SELECT 
        dc.id,
        dc.barcode,
        dc.product_id,
        p.name as product_name,
        dc.grade,
        g.name as grade_name,
        dc.mass,
        dc.price,
        dc.operation_no,
        dc.tobacco_type,
        dc.pickings_weight,
        dc.amount,
        dc.existing_bale_id,
        dc.create_date
       FROM warehouse_data_capturing dc
       LEFT JOIN warehouse_product p ON dc.product_id = p.id
       LEFT JOIN warehouse_bale_grade g ON dc.grade = g.id
       ORDER BY dc.create_date DESC`,
      [],
      {
        onResult: (result) => {
          const rows = result.rows?._array || [];
          setRecords(rows);
          setFiltered(rows);
          setLoading(false);
        },
        onError: (err) => {
          console.error('Failed to load data capturing records', err);
          setLoading(false);
        }
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(records);
      return;
    }
    const q = text.toLowerCase();
    setFiltered(
      records.filter(
        (r) =>
          r.barcode?.toLowerCase().includes(q) ||
          r.product_name?.toLowerCase().includes(q) ||
          r.grade_name?.toLowerCase().includes(q) ||
          r.operation_no?.toLowerCase().includes(q) ||
          r.tobacco_type?.toLowerCase().includes(q)
      )
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const RecordItem = ({ item }: { item: DataCapture }) => (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
      activeOpacity={0.8}
      onPress={() => router.push({
        pathname: '/(app)/inventory/manual-entries/data-capturing-record-detail',
        params: { id: item.id }
      })}
    >
      <View className="flex-row justify-between">
        <View className="flex-1">
          <Text className="text-lg font-bold text-[#65435C]">{item.barcode || 'No barcode'}</Text>
          <Text className="text-sm text-gray-600">
            {item.product_name || 'No product'} • {item.grade_name || 'No grade'}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Mass: {item.mass ?? 0} • Price: {item.price ?? 0}
          </Text>
          {item.operation_no ? (
            <Text className="text-xs text-gray-500 mt-1">Operation: {item.operation_no}</Text>
          ) : null}
          {item.tobacco_type ? (
            <Text className="text-xs text-gray-500 mt-1">Type: {item.tobacco_type}</Text>
          ) : null}
          {item.pickings_weight ? (
            <Text className="text-xs text-gray-500 mt-1">Pickings Weight: {item.pickings_weight}</Text>
          ) : null}
          {item.amount ? (
            <Text className="text-xs text-gray-500 mt-1">Amount: {item.amount}</Text>
          ) : null}
          <Text className="text-xs text-gray-400 mt-1">Captured: {formatDate(item.create_date)}</Text>
          {item.existing_bale_id ? (
            <Text className="text-xs text-green-700 mt-1 font-semibold">Matches existing bale</Text>
          ) : (
            <Text className="text-xs text-orange-700 mt-1 font-semibold">New barcode</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="text-lg text-[#65435C] mt-2">Loading Data Capturing Records...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Data Capturing Records',
          headerShown: true,
        }}
      />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-row items-center justify-between gap-2 mb-4 h-14">
          <View className="relative w-[80%]">
            <View className="absolute left-3 top-4 z-10">
              <Search size={20} color="#65435C" />
            </View>
            <TextInput
              placeholder="Search barcode, product, grade..."
              placeholderTextColor="#65435C"
              className="text-white text-lg bg-[#937B8C] rounded-full p-4 pl-12 w-full"
              value={search}
              onChangeText={handleSearch}
            />
          </View>
          <View className="flex-row items-center justify-center h-12 w-[20%]">
            <Text className="text-white font-bold text-2xl text-center">{filtered.length}</Text>
          </View>
        </View>

        <View className="flex-1 bg-white rounded-2xl p-4">
          {filtered.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-gray-600">No data capturing records found.</Text>
            </View>
          ) : (
            <FlashList
              data={filtered}
              renderItem={({ item }) => <RecordItem item={item} />}
              estimatedItemSize={120}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </>
  );
};

export default DataCapturingRecordsScreen;


