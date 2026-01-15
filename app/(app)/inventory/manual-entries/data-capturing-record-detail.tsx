import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';

type DataCaptureDetail = {
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
  existing_bale_barcode?: string;
  create_date?: string;
  write_date?: string;
};

const DataCapturingRecordDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [record, setRecord] = useState<DataCaptureDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Data capturing record ID not found.');
      router.back();
      return;
    }

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
        sb.barcode as existing_bale_barcode,
        dc.create_date,
        dc.write_date
       FROM warehouse_data_capturing dc
       LEFT JOIN warehouse_product p ON dc.product_id = p.id
       LEFT JOIN warehouse_bale_grade g ON dc.grade = g.id
       LEFT JOIN warehouse_shipped_bale sb ON dc.existing_bale_id = sb.id
       WHERE dc.id = ?
       LIMIT 1`,
      [id],
      {
        onResult: (result) => {
          const row = result.rows?._array?.[0];
          if (!row) {
            Alert.alert('Error', 'Data capturing record not found.');
            router.back();
            return;
          }
          setRecord(row);
          setLoading(false);
        },
        onError: (err) => {
          console.error('Failed to load data capturing record:', err);
          Alert.alert('Error', 'Failed to load data capturing record details.');
          setLoading(false);
        },
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, [id, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const InfoRow = ({ label, value }: { label: string; value?: string | number }) => (
    <View className="flex-row justify-between py-2 border-b border-gray-100">
      <Text className="text-gray-600 font-medium">{label}</Text>
      <Text className="text-gray-800 font-semibold">{value || 'N/A'}</Text>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="text-lg text-[#65435C] mt-2">Loading...</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Data capturing record not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: record.barcode || 'Data Capturing Record',
          headerShown: true,
        }} 
      />
      <ScrollView className="flex-1 bg-white">
        <View className="p-4">
          {/* Header Section */}
          <View className="bg-blue-100 rounded-lg border border-blue-300 p-4 mb-4">
            <Text className="text-xl font-bold text-blue-900 mb-2">
              {record.barcode || 'No Barcode'}
            </Text>
            {record.existing_bale_id ? (
              <View className="flex-row items-center mt-2">
                <Text className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  ✓ Matches Existing Bale
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center mt-2">
                <Text className="text-sm font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                  New Barcode
                </Text>
              </View>
            )}
          </View>

          {/* Basic Information */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Basic Information</Text>
            <InfoRow label="Barcode" value={record.barcode} />
            <InfoRow label="Product" value={record.product_name} />
            <InfoRow label="Grade" value={record.grade_name} />
            <InfoRow label="Mass" value={record.mass ? `${record.mass}kg` : 'N/A'} />
            <InfoRow label="Price" value={record.price || 'N/A'} />
          </View>

          {/* Operation Details */}
          {(record.operation_no || record.tobacco_type || record.pickings_weight || record.amount) && (
            <View className="bg-gray-50 rounded-lg p-4 mb-4">
              <Text className="text-lg font-bold text-[#65435C] mb-3">Operation Details</Text>
              {record.operation_no && <InfoRow label="Operation Number" value={record.operation_no} />}
              {record.tobacco_type && <InfoRow label="Tobacco Type" value={record.tobacco_type} />}
              {record.pickings_weight && <InfoRow label="Pickings Weight" value={`${record.pickings_weight}kg`} />}
              {record.amount && <InfoRow label="Amount" value={record.amount} />}
            </View>
          )}

          {/* Existing Bale Information */}
          {record.existing_bale_id && (
            <View className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
              <Text className="text-lg font-bold text-[#65435C] mb-3">Existing Bale Match</Text>
              <InfoRow label="Existing Bale ID" value={record.existing_bale_id} />
              <InfoRow label="Existing Bale Barcode" value={record.existing_bale_barcode} />
            </View>
          )}

          {/* Timestamps */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Timestamps</Text>
            <InfoRow label="Created" value={formatDate(record.create_date)} />
            <InfoRow label="Last Updated" value={formatDate(record.write_date)} />
          </View>
        </View>
      </ScrollView>
    </>
  );
};

export default DataCapturingRecordDetailScreen;

