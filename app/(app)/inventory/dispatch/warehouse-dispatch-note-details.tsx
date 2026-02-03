import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { powersync } from '@/powersync/system';
import { FlashList } from '@shopify/flash-list';
import { Camera, CheckCircle, Truck, X } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type DispatchNoteDetail = {
  id: string;
  mobile_app_id?: string;
  reference?: string;
  name?: string;
  warehouse_source_id?: string;
  warehouse_source_name?: string;
  warehouse_destination_id?: string;
  warehouse_destination_name?: string;
  transport_id?: string;
  transport_name?: string;
  product_id?: string;
  product_name?: string;
  instruction_id?: string;
  instruction_name?: string;
  truck_reg_number?: string;
  driver_id?: string;
  driver_name?: string;
  driver_national_id?: string;
  driver_cellphone?: string;
  state?: string;
  create_date?: string;
  no_transportation_details?: number;
};

type DispatchedBale = {
  id: string;
  shipped_bale_id?: string;
  barcode?: string;
  logistics_barcode?: string;
  shipped_mass?: number;
  state?: string;
  grower_number?: string;
  shipped_grade?: string;
  stock_status?: string;
};

const DispatchNoteDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dispatchNote, setDispatchNote] = useState<DispatchNoteDetail | null>(null);
  const [dispatchedBales, setDispatchedBales] = useState<DispatchedBale[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [balesCollapsed, setBalesCollapsed] = useState(true);
  
  // States for Transportation Form
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [transportId, setTransportId] = useState('');
  const [isAddingNewTransporter, setIsAddingNewTransporter] = useState(false);
  const [newTransportName, setNewTransportName] = useState('');
  const [truckReg, setTruckReg] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAddingNewDriver, setIsAddingNewDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverNationalId, setDriverNationalId] = useState('');
  const [driverCellphone, setDriverCellphone] = useState('');
  const [transporters, setTransporters] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isSavingTransport, setIsSavingTransport] = useState(false);

  // Search text states for type-and-search
  const [transportSearchText, setTransportSearchText] = useState('');
  const [driverSearchText, setDriverSearchText] = useState('');
  const [isTransportFocused, setIsTransportFocused] = useState(false);
  const [isDriverFocused, setIsDriverFocused] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  useEffect(() => {
    const fetchTransportData = async () => {
      try {
        const [t, d] = await Promise.all([
          powersync.getAll<any>('SELECT * FROM warehouse_transport ORDER BY name ASC'),
          powersync.getAll<any>('SELECT * FROM warehouse_driver ORDER BY name ASC'),
        ]);
        setTransporters(t);
        setDrivers(d);

        // Pre-fill existing details if available
        if (dispatchNote) {
          if (dispatchNote.transport_id) {
            const transportIdStr = String(dispatchNote.transport_id);
            setTransportId(transportIdStr);
            const transport = t.find((tr: any) => String(tr.id) === transportIdStr);
            if (transport) {
              setSelectedTransport(transport);
              setTransportSearchText(transport.name || '');
            }
          }
          if (dispatchNote.truck_reg_number) setTruckReg(dispatchNote.truck_reg_number);
          if (dispatchNote.driver_id) {
            const drvId = String(dispatchNote.driver_id);
            setSelectedDriverId(drvId);
            const drv = d.find((driver: any) => String(driver.id) === drvId);
            if (drv) {
              setSelectedDriver(drv);
              setDriverSearchText(drv.name || '');
              setDriverName(drv.name || '');
              setDriverNationalId(drv.national_id || '');
              setDriverCellphone(drv.cellphone || '');
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch transport data:', err);
      }
    };
    if (showTransportModal) fetchTransportData();
  }, [showTransportModal]);

  const handleDriverSelect = (driver: any) => {
    setSelectedDriver(driver);
    setSelectedDriverId(String(driver.id));
    setDriverSearchText(driver.name || '');
    setIsDriverFocused(false);
    setIsAddingNewDriver(false);
    setDriverName(driver.name || '');
    setDriverNationalId(driver.national_id || '');
    setDriverCellphone(driver.cellphone || '');
  };

  const handleDriverChange = (text: string) => {
    setDriverSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedDriver(null);
      setSelectedDriverId('');
      setIsAddingNewDriver(false);
      setDriverName('');
      setDriverNationalId('');
      setDriverCellphone('');
    }
  };

  const handleTransportSelect = (transport: any) => {
    setSelectedTransport(transport);
    setTransportId(String(transport.id));
    setTransportSearchText(transport.name || '');
    setIsTransportFocused(false);
    setIsAddingNewTransporter(false);
  };

  const handleTransportChange = (text: string) => {
    setTransportSearchText(text);
    if (!text || text.trim().length === 0) {
      setSelectedTransport(null);
      setTransportId('');
      setIsAddingNewTransporter(false);
      setNewTransportName('');
    }
  };

  const saveTransportDetails = async () => {
    const effectiveTransportId = isAddingNewTransporter ? newTransportName.trim() : transportId;
    if (!effectiveTransportId || !truckReg || !driverName || !driverNationalId || !driverCellphone) {
      Alert.alert('Missing Info', 'Please fill in all transportation details.');
      return;
    }

    setIsSavingTransport(true);
    try {
      const now = new Date().toISOString();
      let finalTransportId = transportId;
      let finalDriverId = selectedDriverId;

      if (isAddingNewTransporter && newTransportName.trim()) {
        const tid = uuidv4();
        await powersync.execute(
          'INSERT INTO warehouse_transport (id, name, active, create_date, write_date) VALUES (?, ?, 1, ?, ?)',
          [tid, newTransportName.trim(), now, now]
        );
        finalTransportId = tid;
      }

      if (isAddingNewDriver && driverName.trim()) {
        const did = uuidv4();
        await powersync.execute(
          'INSERT INTO warehouse_driver (id, name, national_id, cellphone, active, create_date, write_date) VALUES (?, ?, ?, ?, 1, ?, ?)',
          [did, driverName.trim(), driverNationalId.toUpperCase(), driverCellphone, now, now]
        );
        finalDriverId = did;
      }

      await powersync.execute(
        `UPDATE warehouse_dispatch_note 
         SET transport_id = ?, truck_reg_number = ?, driver_id = ?, 
             driver_name = ?, driver_national_id = ?, driver_cellphone = ?, 
             no_transportation_details = 0, write_date = ?
         WHERE id = ? OR mobile_app_id = ?`,
        [
          finalTransportId, truckReg.toUpperCase(), finalDriverId,
          driverName.trim(), driverNationalId.toUpperCase(), driverCellphone,
          now, dispatchNote?.id || id, id
        ]
      );

      Alert.alert('Success', 'Transportation details added.');
      setShowTransportModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save transport details.');
    } finally {
      setIsSavingTransport(false);
    }
  };

  const formatStockStatus = (status?: string) => {
    if (!status) return '';
    // Convert technical codes like 'in_stock' to 'In Stock'
    return status
      .toString()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

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
            src.name as warehouse_source_name,
            dest.name as warehouse_destination_name,
            t.name as transport_name,
            p.name as product_name,
            inst.name as instruction_name,
            COALESCE(dn.driver_name, drv.name) as driver_name,
            COALESCE(dn.driver_national_id, drv.national_id) as driver_national_id,
            COALESCE(dn.driver_cellphone, drv.cellphone) as driver_cellphone
           FROM warehouse_dispatch_note dn
           LEFT JOIN warehouse_warehouse src ON dn.warehouse_source_id = src.id
           LEFT JOIN warehouse_warehouse dest ON dn.warehouse_destination_id = dest.id
           LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
           LEFT JOIN warehouse_product p ON dn.product_id = p.id
           LEFT JOIN warehouse_instruction inst ON dn.instruction_id = inst.id
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
              
              // Optimized query: Use the same id parameter from the route (could be numeric ID or mobile_app_id UUID)
              // Join with dispatch note to match by either id or mobile_app_id
              // Simplified JOINs to improve performance with many bales
              powersync.watch(
                `SELECT 
                  db.id,
                  db.shipped_bale_id,
                  COALESCE(db.barcode, sb.barcode, sb.logistics_barcode) AS barcode,
                  db.logistics_barcode,
                  COALESCE(db.shipped_mass, sb.received_mass, sb.mass) AS shipped_mass,
                  db.state,
                  sb.grower_number,
                  g.name AS shipped_grade,
                  sb.stock_status
                 FROM warehouse_dispatch_bale db
                 LEFT JOIN warehouse_dispatch_note dn 
                   ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
                 LEFT JOIN warehouse_shipped_bale sb 
                   ON db.shipped_bale_id = sb.id
                 LEFT JOIN warehouse_bale_grade g
                   ON sb.grade = g.id
                 WHERE (dn.id = ? OR dn.mobile_app_id = ?)
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
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-gray-800">
            {bale.barcode || 'N/A'}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">
            Grower: {bale.grower_number || 'N/A'} | Grade: {bale.shipped_grade || 'N/A'} | Mass: {bale.shipped_mass ?? 0} kg
          </Text>
        </View>
        {bale.stock_status && (
          <View className="px-2 py-1 rounded-full bg-green-100 border border-green-300">
            <Text className="text-[10px] font-semibold text-green-800">
              {formatStockStatus(bale.stock_status)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const handleScanBales = () => {
    if (!dispatchNote?.warehouse_source_id) {
      Alert.alert('Error', 'Please set the source warehouse before scanning bales.');
      return;
    }
    router.push({
      pathname: '/(app)/inventory/dispatch/scan-bales',
      params: { dispatchNoteId: dispatchNote.id || id },
    });
  };

  const handleScanPallets = () => {
    if (!dispatchNote?.warehouse_source_id) {
      Alert.alert('Error', 'Please set the source warehouse before scanning pallets.');
      return;
    }
    router.push({
      pathname: '/(app)/inventory/dispatch/scan-pallets',
      params: { dispatchNoteId: dispatchNote.id || id },
    });
  };

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
                'SELECT id, state, write_date FROM warehouse_dispatch_note WHERE id = ? OR mobile_app_id = ?',
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
                `UPDATE warehouse_dispatch_note 
                 SET state = ?, write_date = ? 
                 WHERE id = ? OR mobile_app_id = ?`,
                ['posted', now, localNoteBefore?.id || id, id]
              );

              // Mirror Odoo action_post logic for bales
              if (!dispatchNote) throw new Error('Dispatch note details missing');

              const destWh = await powersync.getOptional<any>(
                'SELECT warehouse_type FROM warehouse_warehouse WHERE id = ?',
                [String(dispatchNote.warehouse_destination_id)]
              );

              const isInternal = destWh?.warehouse_type === 'internal' || destWh?.warehouse_type === 'factory_storage';
              const noTransport = !!dispatchNote.no_transportation_details;

              // Preload default destination location (used for both internal no-transport and external)
              const destDefaultLocation = await powersync.getOptional<any>(
                'SELECT id FROM warehouse_location WHERE warehouse_id = ? AND default_location = 1 LIMIT 1',
                [String(dispatchNote.warehouse_destination_id)]
              );

              for (const bale of dispatchedBales) {
                if (!bale.shipped_bale_id) {
                  console.warn('⚠️ Skipping bale without shipped_bale_id during dispatch post:', bale.id);
                  continue;
                }

                let stockStatus = 'out_stock';
                let received = 0;
                let dispatched = 1;
                let locationId: string | null = null;
                let dispatchReference: string | null = null;

                if (isInternal) {
                  if (noTransport) {
                    // Internal + no transport: directly received into destination default location
                    stockStatus = 'in_stock';
                    received = 1;
                    locationId = destDefaultLocation?.id ? String(destDefaultLocation.id) : null;
                  } else {
                    // Internal with transport: in transit
                    stockStatus = 'in_transit';
                    received = 0;
                  }
                } else {
                  // External warehouse handling – mirror Odoo action_post semantics
                  stockStatus = 'out_stock';
                  received = 0;
                  dispatchReference = dispatchNote.reference || null;
                  locationId = destDefaultLocation?.id ? String(destDefaultLocation.id) : null;
                }

                await powersync.execute(
                  `UPDATE warehouse_shipped_bale 
                   SET stock_status = ?, 
                       received = ?, 
                       dispatched = ?, 
                       warehouse_id = ?,
                       dispatch_reference = ?,
                       location_id = COALESCE(?, location_id),
                       write_date = ?
                   WHERE id = ?`,
                  [
                    stockStatus,
                    received,
                    dispatched,
                    dispatchNote.warehouse_destination_id,
                    dispatchReference,
                    locationId,
                    now,
                    bale.shipped_bale_id
                  ]
                );
              }

              const localNoteAfter = await powersync.getOptional<any>(
                'SELECT state, write_date FROM warehouse_dispatch_note WHERE id = ? OR mobile_app_id = ?',
                [id, id]
              );
              console.log('📋 Dispatch post local update complete', {
                id,
                afterState: localNoteAfter?.state,
                afterWriteDate: localNoteAfter?.write_date,
              });

              // Force immediate refresh of the dispatch note to show updated state
              // Query immediately after update to ensure we get the latest state
              const note = await powersync.getOptional<any>(
                `SELECT 
                  dn.*,
                  src.name as warehouse_source_name,
                  dest.name as warehouse_destination_name,
                  t.name as transport_name,
                  p.name as product_name,
                  inst.name as instruction_name
                 FROM warehouse_dispatch_note dn
                 LEFT JOIN warehouse_warehouse src ON dn.warehouse_source_id = src.id
                 LEFT JOIN warehouse_warehouse dest ON dn.warehouse_destination_id = dest.id
                 LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
                 LEFT JOIN warehouse_product p ON dn.product_id = p.id
                 LEFT JOIN warehouse_instruction inst ON dn.instruction_id = inst.id
                 WHERE dn.id = ? OR dn.mobile_app_id = ?`,
                [id, id]
              );
              
              if (note) {
                console.log('🔄 Updating dispatch note state in UI:', { 
                  id, 
                  state: note.state,
                  previousState: dispatchNote?.state,
                  noteId: note.id,
                  mobileAppId: note.mobile_app_id
                });
                // Update state immediately
                setDispatchNote(note);
                
                // Show success alert after state is updated
                Alert.alert('Success', 'Dispatch note posted.');
              } else {
                console.warn('⚠️ Could not fetch updated dispatch note after posting');
                Alert.alert('Success', 'Dispatch note posted. Refreshing...');
                // If query fails, wait a bit and try again (watcher should pick it up)
                setTimeout(async () => {
                  const retryNote = await powersync.getOptional<any>(
                    `SELECT * FROM warehouse_dispatch_note WHERE id = ? OR mobile_app_id = ?`,
                    [id, id]
                  );
                  if (retryNote) {
                    setDispatchNote({ ...dispatchNote, state: retryNote.state });
                  }
                }, 500);
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
      <View className="flex-1 bg-white">
        {/* Transport Modal */}
        <Modal
          visible={showTransportModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTransportModal(false)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl p-6 h-[85%]">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-[#65435C]">Transport Details</Text>
                <TouchableOpacity onPress={() => setShowTransportModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                {/* Transporter type-and-search */}
                <View className="mb-4">
                  <Text className="text-gray-700 mb-1 font-semibold">Transporter</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    placeholder="Type to search transporter or add new..."
                    value={transportSearchText}
                    onChangeText={handleTransportChange}
                    onFocus={() => setIsTransportFocused(true)}
                    onBlur={() => setTimeout(() => setIsTransportFocused(false), 100)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {(isTransportFocused || (transportSearchText && transportSearchText.trim().length > 0 && !selectedTransport && !isAddingNewTransporter)) && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {/* Add New Transporter option */}
                        {transportSearchText.trim().length > 0 && (
                        <TouchableOpacity
                          className="p-3 border-b border-gray-100 bg-blue-50"
                          onPress={() => {
                            setIsAddingNewTransporter(true);
                              setNewTransportName(transportSearchText);
                            setSelectedTransport(null);
                            setTransportId('');
                              setIsTransportFocused(false);
                              Keyboard.dismiss();
                          }}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base text-blue-700 font-semibold">
                              + Add New: "{transportSearchText}"
                          </Text>
                        </TouchableOpacity>
                        )}
                        {transporters
                          .filter((t) =>
                            (t.name || '').toLowerCase().includes(transportSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((t) => (
                            <TouchableOpacity
                              key={t.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => {
                                handleTransportSelect(t);
                                Keyboard.dismiss();
                              }}
                              activeOpacity={0.7}
                            >
                              <Text className="text-base text-gray-900">{t.name}</Text>
                            </TouchableOpacity>
                          ))}
                        {transporters.filter((t) =>
                          (t.name || '').toLowerCase().includes(transportSearchText.toLowerCase())
                        ).length === 0 && transportSearchText.trim().length > 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No transporters found. Use "+ Add New" above.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {isAddingNewTransporter && (
                  <View className="mb-4">
                    <Text className="text-gray-700 mb-1 font-semibold">New Transporter Name</Text>
                    <TextInput
                      className="bg-gray-100 border border-gray-300 rounded-lg p-3"
                      value={newTransportName}
                      onChangeText={(text) => {
                        setNewTransportName(text);
                        setTransportSearchText(text);
                      }}
                      placeholder="Enter transporter name"
                    />
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-gray-700 mb-1 font-semibold">Truck Reg Number</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3"
                    value={truckReg}
                    onChangeText={setTruckReg}
                    placeholder="e.g. ABC 1234"
                    autoCapitalize="characters"
                  />
                </View>

                {/* Driver type-and-search */}
                <View className="mb-4">
                  <Text className="text-gray-700 mb-1 font-semibold">Driver</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    placeholder="Type to search driver or add new..."
                    value={driverSearchText}
                    onChangeText={handleDriverChange}
                    onFocus={() => setIsDriverFocused(true)}
                    onBlur={() => setTimeout(() => setIsDriverFocused(false), 100)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {(isDriverFocused || (driverSearchText && driverSearchText.trim().length > 0 && !selectedDriver && !isAddingNewDriver)) && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white" style={{ zIndex: 1000 }}>
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {/* Add New Driver option */}
                        {driverSearchText.trim().length > 0 && (
                        <TouchableOpacity
                          className="p-3 border-b border-gray-100 bg-blue-50"
                          onPress={() => {
                            setIsAddingNewDriver(true);
                              setDriverName(driverSearchText);
                            setSelectedDriver(null);
                            setSelectedDriverId('');
                            setDriverNationalId('');
                            setDriverCellphone('');
                              setIsDriverFocused(false);
                              Keyboard.dismiss();
                          }}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base text-blue-700 font-semibold">
                              + Add New: "{driverSearchText}"
                          </Text>
                        </TouchableOpacity>
                        )}
                        {drivers
                          .filter((d) =>
                            (d.name || '').toLowerCase().includes(driverSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((d) => (
                            <TouchableOpacity
                              key={d.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => {
                                handleDriverSelect(d);
                                Keyboard.dismiss();
                              }}
                              activeOpacity={0.7}
                            >
                              <Text className="text-base text-gray-900">{d.name}</Text>
                            </TouchableOpacity>
                          ))}
                        {drivers.filter((d) =>
                          (d.name || '').toLowerCase().includes(driverSearchText.toLowerCase())
                        ).length === 0 && driverSearchText.trim().length > 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No drivers found. Use "+ Add New" above.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 mb-1 font-semibold">Driver Name</Text>
                  <TextInput
                    className={`border border-gray-300 rounded-lg p-3 ${isAddingNewDriver ? 'bg-gray-100' : 'bg-gray-200'}`}
                    value={driverName}
                    onChangeText={setDriverName}
                    placeholder="Full name"
                    editable={isAddingNewDriver}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 mb-1 font-semibold">National ID</Text>
                  <TextInput
                    className={`border border-gray-300 rounded-lg p-3 ${isAddingNewDriver ? 'bg-gray-100' : 'bg-gray-200'}`}
                    value={driverNationalId}
                    onChangeText={setDriverNationalId}
                    placeholder="ID number"
                    editable={isAddingNewDriver}
                    autoCapitalize="characters"
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-gray-700 mb-1 font-semibold">Cellphone</Text>
                  <TextInput
                    className={`border border-gray-300 rounded-lg p-3 ${isAddingNewDriver ? 'bg-gray-100' : 'bg-gray-200'}`}
                    value={driverCellphone}
                    onChangeText={setDriverCellphone}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                    editable={isAddingNewDriver}
                  />
                </View>

                <TouchableOpacity
                  onPress={saveTransportDetails}
                  className="bg-[#65435C] p-4 rounded-xl items-center justify-center mb-8"
                  disabled={isSavingTransport}
                >
                  {isSavingTransport ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-lg">Save Details</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <FlashList
          data={balesCollapsed ? [] : dispatchedBales}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BaleItem bale={item} />}
          estimatedItemSize={70}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            <View>
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
                    (() => {
                      const state = String(dispatchNote.state || '').toLowerCase();
                      if (state === 'draft') return 'bg-yellow-100 text-yellow-800';
                      if (state === 'posted' || state === 'reconciled') return 'bg-green-100 text-green-800';
                      return 'bg-gray-100 text-gray-800';
                    })()
              }`}>
                {(dispatchNote.state || 'N/A').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Dispatch Note Information */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-3">Dispatch Information</Text>
            <InfoRow label="Reference" value={dispatchNote.reference} />
            <InfoRow label="Source Warehouse" value={dispatchNote.warehouse_source_name} />
            <InfoRow label="Destination Warehouse" value={dispatchNote.warehouse_destination_name} />
            <InfoRow label="Product" value={dispatchNote.product_name} />
                <InfoRow label="Instruction" value={dispatchNote.instruction_name} />
            
            {dispatchNote.no_transportation_details !== 1 && (
              <>
            <InfoRow label="Transport" value={dispatchNote.transport_name} />
            <InfoRow label="Truck Reg" value={dispatchNote.truck_reg_number} />
            <InfoRow label="Driver Name" value={dispatchNote.driver_name} />
            <InfoRow label="Driver ID" value={dispatchNote.driver_national_id} />
            <InfoRow label="Driver Phone" value={dispatchNote.driver_cellphone} />
              </>
            )}
            
            <InfoRow label="Created" value={formatDate(dispatchNote.create_date)} />
          </View>

              {/* Add Transportation Details Button */}
              {String(dispatchNote.state || '').toLowerCase() === 'draft' && (
                <TouchableOpacity
                  onPress={() => setShowTransportModal(true)}
                  className="bg-[#65435C] p-4 rounded-lg items-center justify-center flex-row mb-4"
                >
                  <Truck size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">
                    {Number(dispatchNote.no_transportation_details) === 1 || (!dispatchNote.transport_id && !dispatchNote.driver_id)
                      ? 'Add Transport Details' 
                      : 'Update Transport Details'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                onPress={() => setBalesCollapsed(!balesCollapsed)}
                className="flex-row justify-between items-center bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200"
              >
              <Text className="text-lg font-bold text-[#65435C]">
                Dispatched Bales ({dispatchedBales.length})
              </Text>
                <Text className="text-[#65435C] font-semibold">
                  {balesCollapsed ? 'Show' : 'Hide'}
                </Text>
              </TouchableOpacity>

              {!balesCollapsed && dispatchedBales.length === 0 && (
                <Text className="text-gray-600 text-center py-4">No bales dispatched yet.</Text>
              )}
            </View>
          }
          ListFooterComponent={
            <View className="mt-4 mb-10">
              {/* Action Buttons */}
              <View className="flex-row gap-3">
                {(() => {
                  const state = String(dispatchNote.state || '').toLowerCase();
                  const isPostedOrReconciled = state === 'posted' || state === 'reconciled';
                  
                  if (isPostedOrReconciled) {
                    return (
                      <TouchableOpacity
                        className="flex-1 bg-gray-400 p-4 rounded-lg items-center justify-center flex-row"
                        disabled={true}
                      >
                        <CheckCircle size={19} color="white" />
                        <Text className="text-white font-bold text-sm ml-2">Already Posted</Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  return (
              <>
                <TouchableOpacity
                  onPress={handleScanBales}
                  className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting}
                >
                  <Camera size={19} color="white" />
                  <Text className="text-white font-bold text-sm ml-2">Scan Bale</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleScanPallets}
                  className="flex-1 bg-[#4B5563] p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting}
                >
                  <Camera size={19} color="white" />
                  <Text className="text-white font-bold text-sm ml-2">Scan Pallets</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePostDispatch}
                  className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center flex-row"
                  disabled={posting || dispatchedBales.length === 0}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <CheckCircle size={19} color="white" />
                  )}
                  <Text className="text-white font-bold text-sm ml-2">
                    {posting ? 'Posting...' : 'Post'}
                  </Text>
                </TouchableOpacity>
              </>
                  );
                })()}
          </View>
        </View>
          }
        />
      </View>
    </>
  );
};

export default DispatchNoteDetailScreen;

