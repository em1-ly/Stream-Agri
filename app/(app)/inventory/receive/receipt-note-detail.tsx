import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';

type ReceiptNoteDetail = {
  id: string;
  reference?: string;
  origin?: string;
  destination_id?: string;
  destination_name?: string;
  dnote_date?: string;
  transport_id?: string;
  transport_name?: string;
  truck_reg_number?: string;
  driver_name?: string;
  driver_national_id?: string;
  driver_cellphone?: string;
  product_id?: string;
  product_name?: string;
  total_bales?: number;
  received_bales?: number;
  shipped_mass?: number;
  received_mass?: number;
  total_stacked?: number;
  stacked_mass?: number;
  state?: string;
};

type ShippedBaleRow = {
  id: string;
  barcode?: string;
  lot_number?: string;
  mass?: number;
  price?: number;
  received?: number;
  received_mass?: number;
  stock_status?: string;
};

const ReceiptNoteDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [note, setNote] = useState<ReceiptNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shipped' | 'missing' | 'manual'>('shipped');
  const [shippedBales, setShippedBales] = useState<ShippedBaleRow[]>([]);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Receipt note ID not found.');
      router.back();
      return;
    }

    const controller = new AbortController();

    const startWatcher = async () => {
      try {
        powersync.watch(
          `SELECT 
            dn.*,
            wh.name as destination_name,
            t.name as transport_name,
            p.name as product_name
           FROM warehouse_delivery_note dn
           LEFT JOIN warehouse_warehouse wh ON dn.destination_id = wh.id
           LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
           LEFT JOIN warehouse_product p ON dn.product_id = p.id
           WHERE dn.id = ?
           LIMIT 1`,
          [id],
          {
            onResult: (result) => {
              const record = result.rows?._array?.[0];
              if (!record) {
                Alert.alert('Error', 'Receipt note not found.');
                router.back();
                return;
              }
              setNote(record);
              setLoading(false);
            },
            onError: (err) => {
              console.error('Failed to watch receipt note:', err);
              Alert.alert('Error', 'Failed to load receipt note details.');
              setLoading(false);
            },
          },
          { signal: controller.signal }
        );

        // Watch shipped bales for this delivery note (Shipped Products tab)
        powersync.watch(
          `SELECT 
             db.id,
             sb.barcode,
             sb.lot_number,
             sb.mass,
             sb.price,
             db.received,
             db.received_mass,
             db.stock_status
           FROM warehouse_delivery_bales db
           LEFT JOIN warehouse_shipped_bale sb ON db.shipped_bale_id = sb.id
           WHERE db.delivery_note_id = ?
           ORDER BY db.id DESC`,
          [id],
          {
            onResult: (result) => {
              const rows = (result.rows?._array || []) as ShippedBaleRow[];
              setShippedBales(rows);
            },
            onError: (err) => {
              console.error('Failed to watch shipped products for receipt note:', err);
            },
          },
          { signal: controller.signal }
        );
      } catch (error) {
        console.error('Failed to fetch receipt note details:', error);
        Alert.alert('Error', 'Failed to load receipt note details.');
        setLoading(false);
      }
    };

    startWatcher();

    return () => controller.abort();
  }, [id, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const InfoRow = ({ label, value }: { label: string; value?: string | number }) => (
    <View className="flex-row justify-between py-2 border-b border-gray-100">
      <Text className="text-gray-600 font-medium">{label}</Text>
      <Text className="text-gray-800 font-semibold max-w-[55%]" numberOfLines={2}>
        {value ?? 'N/A'}
      </Text>
    </View>
  );

  if (loading || !note) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color="#65435C" />
          <Text className="text-lg text-[#65435C] mt-2">Loading Receipt Note...</Text>
        </View>
      </>
    );
  }

  const allReceived =
    (note.total_bales ?? 0) > 0 && note.total_bales === note.received_bales;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Receipt Note',
          headerShown: true,
        }}
      />
      <ScrollView className="flex-1 bg-[#65435C]">
        <View className="m-4 bg-white rounded-2xl p-4 shadow-md">
          {/* Header card – mirror Dispatch Note header (state only, no date pill) */}
          <View className="bg-blue-100 rounded-lg border border-blue-300 p-4 mb-4">
            <Text className="text-xl font-bold text-blue-900 mb-2">
              {note.reference || 'Receipt Note'}
            </Text>
            <View className="flex-row justify-start">
              <View
                className={`px-3 py-1 rounded-full ${
                  allReceived ? 'bg-green-100' : 'bg-yellow-100'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    allReceived ? 'text-green-800' : 'text-yellow-800'
                  }`}
                >
                  {(note.state || 'draft').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Action buttons: Print Receipt Report / Add Manual Entry Products */}
          <View className="mb-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-[#65435C] py-3 rounded-xl items-center"
              onPress={() =>
                Alert.alert(
                  'Not Implemented',
                  'Print Receipt Report is not available on mobile yet.'
                )
              }
            >
              <Text className="text-white font-semibold text-sm">Print Receipt Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-gray-200 py-3 rounded-xl items-center"
              onPress={() =>
                Alert.alert(
                  'Not Implemented',
                  'Add Manual Entry Products is not available on mobile yet.'
                )
              }
            >
              <Text className="text-gray-800 font-semibold text-sm">
                Add Manual Entry Products
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#65435C] mb-2">
              Shipment Details
            </Text>
            <InfoRow label="Origin" value={note.origin} />
            <InfoRow label="Destination" value={note.destination_name} />
            <InfoRow label="Product" value={note.product_name} />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#65435C] mb-2">
              Transport & Driver
            </Text>
            <InfoRow label="Transporter" value={note.transport_name} />
            <InfoRow label="Truck Reg Number" value={note.truck_reg_number} />
            <InfoRow label="Driver Name" value={note.driver_name} />
            <InfoRow label="Driver National ID" value={note.driver_national_id} />
            <InfoRow label="Driver Cellphone" value={note.driver_cellphone} />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#65435C] mb-2">
              Totals
            </Text>
            <InfoRow
              label="Bales"
              value={`${note.received_bales ?? 0}/${note.total_bales ?? 0}`}
            />
            <InfoRow
              label="Original Mass"
              value={
                note.shipped_mass != null ? `${note.shipped_mass} kg` : undefined
              }
            />
            <InfoRow
              label="Received Mass"
              value={
                note.received_mass != null ? `${note.received_mass} kg` : undefined
              }
            />
            <InfoRow
              label="Stacked"
              value={
                note.total_stacked != null && note.stacked_mass != null
                  ? `${note.total_stacked} (${note.stacked_mass} kg)`
                  : undefined
              }
            />
          </View>

          {/* Tabs for Shipped / Missing / Manual Entry Products */}
          <View className="mb-4">
            <View className="flex-row bg-gray-100 rounded-lg p-1 mb-3">
              {[
                { key: 'shipped', label: 'Shipped Products' },
                { key: 'missing', label: 'Missing Products' },
                { key: 'manual', label: 'Manual Entry' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  className={`flex-1 py-2 rounded-md items-center ${
                    activeTab === tab.key
                      ? 'bg-white'
                      : 'bg-transparent'
                  }`}
                  onPress={() => setActiveTab(tab.key as typeof activeTab)}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      activeTab === tab.key ? 'text-[#65435C]' : 'text-gray-500'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'shipped' && (
              <View>
                {shippedBales.length === 0 ? (
                  <Text className="text-gray-600 text-center py-3">
                    No shipped products for this receipt note.
                  </Text>
                ) : (
                  shippedBales.map((bale) => (
                    <View
                      key={bale.id}
                      className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200"
                    >
                      <Text className="text-sm font-semibold text-gray-800">
                        {bale.barcode || 'N/A'}
                      </Text>
                      <Text className="text-xs text-gray-600 mt-1">
                        Lot: {bale.lot_number || 'N/A'} | Mass: {bale.mass ?? 0} kg
                      </Text>
                      <Text className="text-xs text-gray-600 mt-1">
                        Price: {bale.price != null ? bale.price : 'N/A'} | Received Mass:{' '}
                        {bale.received_mass != null ? `${bale.received_mass} kg` : 'N/A'}
                      </Text>
                      {bale.stock_status && (
                        <Text className="text-xs text-gray-500 mt-1">
                          Status: {bale.stock_status}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'missing' && (
              <View>
                <Text className="text-gray-600 text-center py-3">
                  Missing Products view is not yet available on mobile.
                </Text>
              </View>
            )}

            {activeTab === 'manual' && (
              <View>
                <Text className="text-gray-600 text-center py-3">
                  Manual Entry Products view is not yet available on mobile.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            className="mt-2 py-3 rounded-xl bg-[#65435C] items-center"
            onPress={() => router.back()}
          >
            <Text className="text-white font-semibold text-base">Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

export default ReceiptNoteDetailScreen;


