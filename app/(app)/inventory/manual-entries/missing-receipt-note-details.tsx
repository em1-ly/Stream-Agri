import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { FlashList } from '@shopify/flash-list';
import { Camera, CheckCircle } from 'lucide-react-native';

type MissingReceiptNoteDetail = {
  id: string;
  reference?: string;
  origin?: string;
  truck_reg_number?: string;
  transport_id?: number;
  transport_name?: string;
  driver_name?: string;
  driver_national_id?: string;
  driver_cellphone?: string;
  dnote_date?: string;
  warehouse_source_id?: number;
  warehouse_source_name?: string;
  warehouse_destination_id?: number;
  warehouse_destination_name?: string;
  state?: string;
  create_date?: string;
  total_bales?: number;
  received_bales?: number;
  shipped_mass?: number;
  received_mass?: number;
};

type MissingShippedBale = {
  id: string;
  barcode?: string;
  grade?: number;
  grade_name?: string;
  lot_number?: string;
  mass?: number;
  received_mass?: number;
  grower_number?: string;
  location_id?: number;
  location_name?: string;
  received?: number;
};

const MissingReceiptNoteDetailsScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [missingNote, setMissingNote] = useState<MissingReceiptNoteDetail | null>(null);
  const [missingBales, setMissingBales] = useState<MissingShippedBale[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Missing receipt note ID not found.');
      router.back();
      return;
    }

    let noteWatcherAbort: AbortController | null = null;
    let baleWatcherAbort: AbortController | null = null;

    const startWatchers = async () => {
      try {
        // Watch a single missing receipt note by id
        noteWatcherAbort = new AbortController();
        powersync.watch(
          `SELECT 
            mdn.*,
            wh_source.name as warehouse_source_name,
            wh_dest.name as warehouse_destination_name,
            t.name as transport_name
           FROM warehouse_missing_dnote mdn
           LEFT JOIN warehouse_warehouse wh_source ON mdn.warehouse_source_id = wh_source.id
           LEFT JOIN warehouse_warehouse wh_dest ON mdn.warehouse_destination_id = wh_dest.id
           LEFT JOIN warehouse_transport t ON mdn.transport_id = t.id
           WHERE mdn.id = ?
           LIMIT 1`,
          [id],
          {
            onResult: (result) => {
              const record = result.rows?._array?.[0];
              if (!record) {
                Alert.alert('Error', 'Missing receipt note not found.');
                router.back();
                return;
              }
              setMissingNote(record);
              setLoading(false);
              
              // Start/Restart bale watcher
              if (baleWatcherAbort) {
                baleWatcherAbort.abort();
              }
              baleWatcherAbort = new AbortController();
              
              powersync.watch(
                `SELECT 
                  msb.id,
                  msb.barcode,
                  msb.lot_number,
                  msb.mass,
                  msb.received_mass,
                  msb.grower_number,
                  msb.location_id,
                  msb.received,
                  g.name as grade_name,
                  loc.name as location_name
                 FROM warehouse_missing_shipped_bale msb
                 LEFT JOIN warehouse_bale_grade g ON msb.grade = g.id
                 LEFT JOIN warehouse_location loc ON msb.location_id = loc.id
                 WHERE msb.missing_dnote_id = ?
                 ORDER BY msb.create_date DESC`,
                [id],
                {
                  onResult: (baleResult) => {
                    const bales = baleResult.rows?._array || [];
                    console.log('📦 Missing bale watcher updated:', { count: bales.length, missingNoteId: id });
                    setMissingBales(bales);
                  },
                  onError: (err) => {
                    console.error('Failed to watch missing shipped bales:', err);
                  },
                },
                { signal: baleWatcherAbort.signal }
              );
            },
            onError: (err) => {
              console.error('Failed to watch missing receipt note:', err);
              Alert.alert('Error', 'Failed to load missing receipt note details.');
              setLoading(false);
            },
          },
          { signal: noteWatcherAbort.signal }
        );
      } catch (error) {
        console.error('Failed to fetch missing receipt note details:', error);
        Alert.alert('Error', 'Failed to load missing receipt note details.');
        setLoading(false);
      }
    };

    startWatchers();

    return () => {
      noteWatcherAbort?.abort();
      baleWatcherAbort?.abort();
    };
  }, [id, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
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

  const BaleItem = ({ bale }: { bale: MissingShippedBale }) => (
    <View className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800">
            {bale.barcode || 'N/A'}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">
            Grade: {bale.grade_name || 'N/A'} | Lot: {bale.lot_number || 'N/A'} | Mass: {bale.mass || 0}kg
            {bale.received_mass && bale.received_mass !== bale.mass && ` (Received: ${bale.received_mass}kg)`}
          </Text>
          {bale.location_name && (
            <Text className="text-xs text-gray-500 mt-1">Location: {bale.location_name}</Text>
          )}
          {bale.received === 1 && (
            <Text className="text-xs text-green-600 mt-1 font-semibold">✓ Received</Text>
          )}
        </View>
      </View>
    </View>
  );

  const handlePostMissingNote = async () => {
    if (!id) {
      Alert.alert('Error', 'Missing receipt note ID not found.');
      return;
    }

    // Validate that there are bales before posting
    if (missingBales.length === 0) {
      Alert.alert('Error', 'Cannot post missing receipt note: no bales have been added.');
      return;
    }

    // Confirm before posting
    Alert.alert(
      'Post Missing Receipt Note',
      'Are you sure you want to post this missing receipt note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Post',
          style: 'destructive',
          onPress: async () => {
            setPosting(true);
            try {
              const now = new Date().toISOString();
              
              const localNoteBefore = await powersync.getOptional<any>(
                'SELECT id, state, write_date FROM warehouse_missing_dnote WHERE id = ?',
                [id]
              );
              
              if (!localNoteBefore) {
                Alert.alert('Error', 'Missing receipt note not found in local database.');
                return;
              }

              console.log('📋 Missing receipt note post requested', {
                id,
                beforeState: localNoteBefore?.state,
                beforeWriteDate: localNoteBefore?.write_date,
              });

              // Update the missing receipt note state to 'posted' locally
              // PowerSync will sync this change, and Connector.ts will detect the state change
              // and route it to the warehouse_missing_dnote_post unified endpoint
              await powersync.execute(
                `UPDATE warehouse_missing_dnote 
                 SET state = ?, write_date = ? 
                 WHERE id = ?`,
                ['posted', now, id]
              );

              const localNoteAfter = await powersync.getOptional<any>(
                'SELECT state, write_date FROM warehouse_missing_dnote WHERE id = ?',
                [id]
              );
              console.log('📋 Missing receipt note post local update complete', {
                id,
                afterState: localNoteAfter?.state,
                afterWriteDate: localNoteAfter?.write_date,
              });

              Alert.alert('Success', 'Missing receipt note posting initiated. It will sync when online.');
              
              // Refresh the data
              const note = await powersync.getOptional<any>(
                `SELECT 
                  mdn.*,
                  wh_source.name as warehouse_source_name,
                  wh_dest.name as warehouse_destination_name,
                  t.name as transport_name
                 FROM warehouse_missing_dnote mdn
                 LEFT JOIN warehouse_warehouse wh_source ON mdn.warehouse_source_id = wh_source.id
                 LEFT JOIN warehouse_warehouse wh_dest ON mdn.warehouse_destination_id = wh_dest.id
                 LEFT JOIN warehouse_transport t ON mdn.transport_id = t.id
                 WHERE mdn.id = ?`,
                [id]
              );
              if (note) {
                setMissingNote(note);
              }
            } catch (error: any) {
              console.error('Failed to post missing receipt note:', error);
              Alert.alert('Error', error.message || 'Failed to post missing receipt note.');
            } finally {
              setPosting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="text-lg text-[#65435C] mt-2">Loading...</Text>
      </View>
    );
  }

  if (!missingNote) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Missing receipt note not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: missingNote.reference || 'Missing Receipt Note',
          headerShown: true,
        }} 
      />
      <ScrollView className="flex-1 bg-white">
        <View className="p-4">
          {/* Header Section */}
          <View className="bg-blue-100 rounded-lg border border-blue-300 p-4 mb-4">
            <Text className="text-xl font-bold text-blue-900 mb-2">
              {missingNote.reference || 'Missing Receipt Note'}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className="text-base font-semibold text-blue-800 mr-2">State:</Text>
              <Text className={`text-sm font-semibold px-2 py-1 rounded-full ${
                missingNote.state === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                missingNote.state === 'posted' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {(missingNote.state || 'N/A').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Missing Receipt Note Information */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Receipt Information</Text>
            <InfoRow label="Reference" value={missingNote.reference} />
            <InfoRow label="Origin" value={missingNote.origin} />
            <InfoRow label="Source Warehouse" value={missingNote.warehouse_source_name} />
            <InfoRow label="Destination Warehouse" value={missingNote.warehouse_destination_name} />
            <InfoRow label="Transport" value={missingNote.transport_name} />
            <InfoRow label="Truck Reg" value={missingNote.truck_reg_number} />
            <InfoRow label="Driver Name" value={missingNote.driver_name} />
            <InfoRow label="Driver ID" value={missingNote.driver_national_id} />
            <InfoRow label="Driver Phone" value={missingNote.driver_cellphone} />
            <InfoRow label="Receipt Date" value={missingNote.dnote_date ? formatDate(missingNote.dnote_date) : 'N/A'} />
            <InfoRow label="Created" value={formatDate(missingNote.create_date)} />
          </View>

          {/* Statistics Section */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Statistics</Text>
            <InfoRow label="Total Bales" value={missingNote.total_bales || 0} />
            <InfoRow label="Received Bales" value={missingNote.received_bales || 0} />
            <InfoRow label="Shipped Mass" value={missingNote.shipped_mass ? `${missingNote.shipped_mass}kg` : '0kg'} />
            <InfoRow label="Received Mass" value={missingNote.received_mass ? `${missingNote.received_mass}kg` : '0kg'} />
          </View>

          {/* Missing Shipped Bales Section */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-[#65435C]">
                Shipped Bales ({missingBales.length})
              </Text>
            </View>
            {missingBales.length === 0 ? (
              <Text className="text-gray-600 text-center py-4">No bales added yet.</Text>
            ) : (
              <FlashList
                data={missingBales}
                renderItem={({ item }) => <BaleItem bale={item} />}
                estimatedItemSize={90}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4">
            {missingNote.state !== 'posted' && (
              <>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/(app)/inventory/manual-entries/missing-receipt-add-bales',
                    params: { missingDnoteId: id }
                  })}
                  className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting}
                >
                  <Camera size={24} color="white" />
                  <Text className="text-white font-bold text-lg ml-2">Add Bales</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePostMissingNote}
                  className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting || missingBales.length === 0}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <CheckCircle size={24} color="white" />
                  )}
                  <Text className="text-white font-bold text-lg ml-2">
                    {posting ? 'Posting...' : 'Post'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {missingNote.state === 'posted' && (
              <TouchableOpacity
                className="flex-1 bg-gray-400 p-4 rounded-lg items-center justify-center flex-row"
                disabled={true}
              >
                <Text className="text-white font-bold text-lg">Already Posted</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
};

export default MissingReceiptNoteDetailsScreen;

