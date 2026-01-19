import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { FlashList } from '@shopify/flash-list';
import { Camera, CheckCircle, Printer, ChevronDown, ChevronUp } from 'lucide-react-native';
import { printFloorDispatchReportLocally } from '@/utils/floorDispatchReportPrint';

type DispatchNoteDetail = {
  id: string;
  reference?: string;
  name?: string;
  warehouse_destination_id?: string;
  warehouse_destination_name?: string;
  transport_id?: string;
  transport_name?: string;
  product_id?: string;
  product_name?: string;
  truck_reg_number?: string;
  driver_name?: string;
  driver_national_id?: string;
  driver_cellphone?: string;
  state?: string;
  create_date?: string;
  origin_id?: string;
  origin_name?: string;
  has_been_printed?: number;
};

type DispatchedBale = {
  id: string;
  receiving_bale_id?: string;
  barcode?: string;
  scale_barcode?: string;
  grower_number?: string;
  lot_number?: string;
  mass?: number;
};

const DispatchNoteDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dispatchNote, setDispatchNote] = useState<DispatchNoteDetail | null>(null);
  const [dispatchedBales, setDispatchedBales] = useState<DispatchedBale[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [balesExpanded, setBalesExpanded] = useState(false);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Dispatch note ID not found.');
      router.back();
      return;
    }

    let noteWatcherAbort: AbortController | null = null;
    let baleWatcherAbort: AbortController | null = null;

    const startWatchers = async () => {
      try {
        // Watch a single dispatch note by id or mobile_app_id
        noteWatcherAbort = new AbortController();
        powersync.watch(
          `SELECT 
            dn.*,
            dn.has_been_printed,
            wh.name as warehouse_destination_name,
            t.name as transport_name,
            p.name as product_name,
            sp.name as origin_name,
            COALESCE(dn.driver_name, drv.name) as driver_name,
            COALESCE(dn.driver_national_id, drv.national_id) as driver_national_id,
            COALESCE(dn.driver_cellphone, drv.cellphone) as driver_cellphone
           FROM floor_dispatch_note dn
           LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
           LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
           LEFT JOIN warehouse_product p ON dn.product_id = p.id
           LEFT JOIN floor_maintenance_selling_point sp ON dn.origin_id = sp.id
           LEFT JOIN warehouse_driver drv ON dn.driver_id = drv.id
           WHERE dn.id = ? OR dn.mobile_app_id = ?
           LIMIT 1`,
          [id, id],
          {
            onResult: (result) => {
              const record = result.rows?._array?.[0];
              if (!record) {
                Alert.alert('Error', 'Dispatch note not found.');
                router.back();
                return;
              }
              setDispatchNote(record);
              setLoading(false);
              
              // Start/Restart bale watcher - join with dispatch note to match by either numeric ID or mobile_app_id
              // This ensures bales are found whether dispatch note was created locally (UUID) or synced (numeric ID)
              if (baleWatcherAbort) {
                baleWatcherAbort.abort();
              }
              baleWatcherAbort = new AbortController();
              
              // Use the same id parameter from the route (could be numeric ID or mobile_app_id UUID)
              // Join with dispatch note to match by either id or mobile_app_id
              // This ensures bales are found immediately whether dispatch note uses UUID or numeric ID
              // The JOIN matches both: db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id
              powersync.watch(
                `SELECT 
                  db.id,
                  db.receiving_bale_id,
                  rb.barcode,
                  rb.scale_barcode,
                  rb.grower_number,
                  rb.lot_number,
                  rb.mass
                 FROM floor_dispatch_bale db
                 LEFT JOIN receiving_bale rb ON db.receiving_bale_id = rb.id
                 LEFT JOIN floor_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
                 WHERE dn.id = ? OR dn.mobile_app_id = ?
                 ORDER BY db.create_date DESC`,
                [id, id],
                {
                  onResult: (baleResult) => {
                    const bales = baleResult.rows?._array || [];
                    console.log('📦 Bale watcher updated:', { count: bales.length, dispatchNoteId: id });
                    setDispatchedBales(bales);
                  },
                  onError: (err) => {
                    console.error('Failed to watch dispatched bales:', err);
                  },
                },
                { signal: baleWatcherAbort.signal }
              );
            },
            onError: (err) => {
              console.error('Failed to watch dispatch note:', err);
              Alert.alert('Error', 'Failed to load dispatch note details.');
              setLoading(false);
            },
          },
          { signal: noteWatcherAbort.signal }
        );
      } catch (error) {
        console.error('Failed to fetch dispatch note details:', error);
        Alert.alert('Error', 'Failed to load dispatch note details.');
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

  const BaleItem = ({ bale }: { bale: DispatchedBale }) => (
    <View className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800">
            {bale.barcode || bale.scale_barcode || 'N/A'}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">
            Grower: {bale.grower_number || 'N/A'} | Lot: {bale.lot_number || 'N/A'} | Mass: {bale.mass || 0}kg
          </Text>
        </View>
      </View>
    </View>
  );

  const handlePostDispatch = async () => {
    if (!id) {
      Alert.alert('Error', 'Dispatch note ID not found.');
      return;
    }

    // Validate that there are bales before posting
    if (dispatchedBales.length === 0) {
      Alert.alert('Error', 'Cannot post dispatch note: no bales have been added.');
      return;
    }

    // Confirm before posting
    Alert.alert(
      'Post Dispatch Note',
      'Are you sure you want to post this dispatch note? This action cannot be undone.',
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
                'SELECT id, state, write_date FROM floor_dispatch_note WHERE id = ? OR mobile_app_id = ?',
                [id, id]
              );
              console.log('📋 Dispatch post requested', {
                id,
                beforeState: localNoteBefore?.state,
                beforeWriteDate: localNoteBefore?.write_date,
              });

              // Update the dispatch note state to 'posted'
              // PowerSync will sync this change, and Connector.ts will handle the API call
              await powersync.execute(
                `UPDATE floor_dispatch_note 
                 SET state = ?, write_date = ? 
                 WHERE id = ? OR mobile_app_id = ?`,
                ['posted', now, localNoteBefore?.id || id, id]
              );

              const localNoteAfter = await powersync.getOptional<any>(
                'SELECT state, write_date FROM floor_dispatch_note WHERE id = ? OR mobile_app_id = ?',
                [id, id]
              );
              console.log('📋 Dispatch post local update complete', {
                id,
                afterState: localNoteAfter?.state,
                afterWriteDate: localNoteAfter?.write_date,
              });

              Alert.alert('Success', 'Dispatch note posted.');
              
              // Refresh the data
              const note = await powersync.getOptional<any>(
                `SELECT 
                  dn.*,
                  wh.name as warehouse_destination_name,
                  t.name as transport_name,
                  p.name as product_name,
                  sp.name as origin_name,
                  COALESCE(dn.driver_name, drv.name) as driver_name,
                  COALESCE(dn.driver_national_id, drv.national_id) as driver_national_id,
                  COALESCE(dn.driver_cellphone, drv.cellphone) as driver_cellphone
                 FROM floor_dispatch_note dn
                 LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
                 LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
                 LEFT JOIN warehouse_product p ON dn.product_id = p.id
                 LEFT JOIN floor_maintenance_selling_point sp ON dn.origin_id = sp.id
                 LEFT JOIN warehouse_driver drv ON dn.driver_id = drv.id
                 WHERE dn.id = ? OR dn.mobile_app_id = ?`,
                [id, id]
              );
              if (note) {
                setDispatchNote(note);
              }
            } catch (error: any) {
              console.error('Failed to post dispatch note:', error);
              Alert.alert('Error', error.message || 'Failed to post dispatch note.');
            } finally {
              setPosting(false);
            }
          }
        }
      ]
    );
  };

  const handlePrint = async () => {
    if (!id) {
      Alert.alert('Error', 'Dispatch note ID not found.');
      return;
    }

    const dispatchNoteId = Array.isArray(id) ? id[0] : id;
    if (!dispatchNoteId) {
      Alert.alert('Error', 'Dispatch note ID not found.');
      return;
    }

    setPrinting(true);
    try {
      await printFloorDispatchReportLocally(dispatchNoteId);
      
      // Update the dispatch note to mark it as printed
      // PowerSync will sync this change to Odoo automatically
      await powersync.execute(
        `UPDATE floor_dispatch_note 
         SET has_been_printed = 1, write_date = ? 
         WHERE id = ? OR mobile_app_id = ?`,
        [new Date().toISOString(), dispatchNoteId, dispatchNoteId]
      );
      
      // Refresh the dispatch note data
      const updatedNote = await powersync.get<DispatchNoteDetail>(
        `SELECT 
          dn.*,
          dn.has_been_printed,
          wh.name as warehouse_destination_name,
          t.name as transport_name,
          p.name as product_name,
          sp.name as origin_name,
          COALESCE(dn.driver_name, drv.name) as driver_name,
          COALESCE(dn.driver_national_id, drv.national_id) as driver_national_id,
          COALESCE(dn.driver_cellphone, drv.cellphone) as driver_cellphone
         FROM floor_dispatch_note dn
         LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
         LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
         LEFT JOIN warehouse_product p ON dn.product_id = p.id
         LEFT JOIN floor_maintenance_selling_point sp ON dn.origin_id = sp.id
         LEFT JOIN warehouse_driver drv ON dn.driver_id = drv.id
         WHERE dn.id = ? OR dn.mobile_app_id = ?
         LIMIT 1`,
        [dispatchNoteId, dispatchNoteId]
      );
      
      if (updatedNote) {
        setDispatchNote(updatedNote);
      }
      
      Alert.alert('Success', 'Dispatch report printed successfully.');
    } catch (error: any) {
      console.error('Failed to print dispatch report:', error);
      Alert.alert('Error', error.message || 'Failed to print dispatch report.');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="text-lg text-[#65435C] mt-2">Loading...</Text>
      </View>
    );
  }

  if (!dispatchNote) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Dispatch note not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: dispatchNote.reference || 'Dispatch Note',
          headerShown: true,
        }} 
      />
      <ScrollView className="flex-1 bg-white">
        <View className="p-4">
          {/* Header Section */}
          <View className="bg-blue-100 rounded-lg border border-blue-300 p-4 mb-4">
            <Text className="text-xl font-bold text-blue-900 mb-2">
              {dispatchNote.reference && dispatchNote.warehouse_destination_name
                ? `${dispatchNote.reference} to ${dispatchNote.warehouse_destination_name}`
                : dispatchNote.reference || dispatchNote.name || 'Dispatch Note'}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className="text-base font-semibold text-blue-800 mr-2">State:</Text>
              <Text className={`text-sm font-semibold px-2 py-1 rounded-full ${
                dispatchNote.state === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                dispatchNote.state === 'posted' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {(dispatchNote.state || 'N/A').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Dispatch Note Information */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Dispatch Information</Text>
            <InfoRow label="Reference" value={dispatchNote.reference} />
            <InfoRow label="Origin" value={dispatchNote.origin_name} />
            <InfoRow label="Destination" value={dispatchNote.warehouse_destination_name} />
            <InfoRow label="Product" value={dispatchNote.product_name} />
            <InfoRow label="Transport" value={dispatchNote.transport_name} />
            <InfoRow label="Truck Reg" value={dispatchNote.truck_reg_number} />
            <InfoRow label="Driver Name" value={dispatchNote.driver_name} />
            <InfoRow label="Driver ID" value={dispatchNote.driver_national_id} />
            <InfoRow label="Driver Phone" value={dispatchNote.driver_cellphone} />
            <InfoRow label="Created" value={formatDate(dispatchNote.create_date)} />
          </View>

          {/* Dispatched Bales Section */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <TouchableOpacity
              onPress={() => setBalesExpanded(!balesExpanded)}
              className="flex-row justify-between items-center mb-3"
            >
              <Text className="text-lg font-bold text-[#65435C]">
                Dispatched Bales ({dispatchedBales.length})
              </Text>
              {dispatchedBales.length > 0 && (
                balesExpanded ? (
                  <ChevronUp size={20} color="#65435C" />
                ) : (
                  <ChevronDown size={20} color="#65435C" />
                )
              )}
            </TouchableOpacity>
            {dispatchedBales.length === 0 ? (
              <Text className="text-gray-600 text-center py-4">No bales dispatched yet.</Text>
            ) : balesExpanded && (
              <FlashList
                data={dispatchedBales}
                renderItem={({ item }) => <BaleItem bale={item} />}
                estimatedItemSize={70}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4">
            {dispatchNote.state !== 'posted' && (
              <>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/(app)/floor-dispatch/scan-bales',
                    params: { dispatchNoteId: dispatchNote.id || id }
                  })}
                  className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting}
                >
                  <Camera size={24} color="white" />
                  <Text className="text-white font-bold text-lg ml-2">Scan Bale</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePostDispatch}
                  className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting || dispatchedBales.length === 0}
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
            {dispatchNote.state === 'posted' && (
              <>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/(app)/floor-dispatch/scan-bales',
                    params: { dispatchNoteId: dispatchNote.id || id }
                  })}
                  className="flex-1 bg-gray-400 p-4 rounded-lg items-center justify-center flex-row"
                  disabled={true}
                >
                  <Text className="text-white font-bold text-lg">Already Posted</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePrint}
                  className={`flex-1 ${(dispatchNote.has_been_printed === 1) ? 'bg-[#65435C]' : 'bg-[#65435C]'} p-4 rounded-lg items-center justify-center flex-row`}
                  disabled={printing}
                >
                  {printing ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Printer size={24} color="white" />
                  )}
                  <Text className="text-white font-bold text-lg ml-2">
                    {printing ? 'Printing...' : (dispatchNote.has_been_printed === 1 ? 'Printed' : 'Print')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Print Button for Draft State */}
          {dispatchNote.state !== 'posted' && (
            <View className="mb-4">
              <TouchableOpacity
                onPress={handlePrint}
                className="bg-[#65435C] p-4 rounded-lg items-center justify-center flex-row"
                disabled={printing}
              >
                {printing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Printer size={24} color="white" />
                )}
                <Text className="text-white font-bold text-lg ml-2">
                  {printing ? 'Printing...' : (dispatchNote.has_been_printed === 1 ? 'Printed' : 'Print')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
};

export default DispatchNoteDetailScreen;

