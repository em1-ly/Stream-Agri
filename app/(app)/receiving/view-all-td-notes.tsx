import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { CircleArrowRight, Search, Filter, ChevronLeft } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define the type for a Transporter Delivery Note based on your Odoo model
type TransporterDeliveryNote = {
  id: string;
  document_number?: string;
  name?: string; // Driver Name
  vehicle_registration?: string;
  transporter_name?: string;
  number_of_bales?: number;
  validated_bales?: number;
  state?: 'open' | 'closed' | 'draft';
  creditor?: string;
  physical_dnote_number?: string;
  pending_validation_count?: number;
};

const ViewAllTDNotes = () => {
  const insets = useSafeAreaInsets();
  const [deliveryNotes, setDeliveryNotes] = useState<TransporterDeliveryNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<TransporterDeliveryNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(!!powersync.currentStatus?.connected);
  const [filterMode, setFilterMode] = useState<'unvalidated' | 'all'>('unvalidated');
  const [pendingMap, setPendingMap] = useState<Record<string, number>>({});
  const [growerLinesMap, setGrowerLinesMap] = useState<Record<string, string[]>>({});

  // Monitor PowerSync connection status
  useEffect(() => {
    const unregister = powersync.registerListener({
      statusChanged: (status) => {
        setSyncStatus(!!status.connected);
      },
    });
    return unregister;
  }, []);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          await powersync.execute('SELECT 1');
          console.log('🔄 PowerSync sync triggered on focus');
        } catch (e) {
          console.warn('⚠️ PowerSync sync failed:', e);
        }
      };
      refreshData();
    }, [])
  );

  // Fetch data from PowerSync when the component mounts
  useEffect(() => {
    setupPowerSync();
    const controller = new AbortController();
    
    // Watch for changes in the delivery notes table
    powersync.watch(
      `SELECT * FROM receiving_transporter_delivery_note ORDER BY document_number DESC`,
      [],
      {
        onResult: (result) => {
          if (result.rows?._array) {
            setDeliveryNotes(result.rows._array as TransporterDeliveryNote[]);
          }
          setLoading(false);
        },
        onError: (err) => {
          console.error('Error fetching delivery notes:', err);
          setLoading(false);
        }
      },
      { signal: controller.signal}
    );

    // Watch pending validations per TD note
    powersync.watch(
      `SELECT transporter_delivery_note_id AS id, COUNT(*) AS pending
       FROM receiving_boka_transporter_delivery_note_line
       WHERE COALESCE(physical_validation_status, '') != 'validated'
       GROUP BY transporter_delivery_note_id`,
      [],
      {
        onResult: (result) => {
          const arr = (result.rows?._array || []) as Array<{ id: number | string; pending: number }>;
          const map: Record<string, number> = {};
          for (const row of arr) {
            map[String(row.id)] = Number(row.pending) || 0;
          }
          setPendingMap(map);
        },
        onError: (err) => console.error('Error fetching pending counts:', err)
      },
      { signal: controller.signal }
    );
    
    // Watch grower lines to build a searchable map of grower numbers
    powersync.watch(
      `SELECT transporter_delivery_note_id, grower_number FROM receiving_boka_transporter_delivery_note_line WHERE grower_number IS NOT NULL`,
      [],
      {
        onResult: (result) => {
          const lines = (result.rows?._array || []) as Array<{ transporter_delivery_note_id: number; grower_number: string }>;
          const map: Record<string, string[]> = {};
          for (const line of lines) {
            const key = String(line.transporter_delivery_note_id);
            if (!map[key]) {
              map[key] = [];
            }
            map[key].push(line.grower_number);
          }
          setGrowerLinesMap(map);
        },
        onError: (err) => console.error('Error fetching grower lines for search:', err)
      },
      { signal: controller.signal }
    );
    
    return () => controller.abort();
  }, []);

  // Update pending_validation_count when pendingMap changes
  useEffect(() => {
    setDeliveryNotes(prevNotes => 
      prevNotes.map(note => ({
        ...note,
        pending_validation_count: pendingMap[String(note.id)] ?? 0
      }))
    );
  }, [pendingMap]);

  // Handle search functionality using a useCallback for performance
  const applyFilters = useCallback(() => {
    const lowercaseQuery = (searchQuery || '').toLowerCase();
    
    const base = filterMode === 'unvalidated'
      ? deliveryNotes.filter(n => (pendingMap[String(n.id)] ?? 0) > 0)
      : deliveryNotes;

    if (lowercaseQuery.trim() === '') {
      setFilteredNotes(base);
      return;
    }

    const filtered = base.filter(
      note =>
        note.document_number?.toLowerCase().includes(lowercaseQuery) ||
        note.name?.toLowerCase().includes(lowercaseQuery) ||
        note.transporter_name?.toLowerCase().includes(lowercaseQuery) ||
        note.vehicle_registration?.toLowerCase().includes(lowercaseQuery) ||
        // Search grower numbers associated with this TD Note
        (growerLinesMap[note.id] || []).some(gn => gn.toLowerCase().includes(lowercaseQuery))
    );
    setFilteredNotes(filtered);
  }, [searchQuery, filterMode, deliveryNotes, pendingMap, growerLinesMap]);

  // Re-run the filter whenever dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleToggleFilter = (mode: 'unvalidated' | 'all') => {
    setFilterMode(mode);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await powersync.execute('SELECT 1'); // Trigger sync
      console.log('🔄 Manual refresh triggered');
      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.warn('⚠️ Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <View className="flex-1 bg-[#65435C]">
        {/* Custom header with back, refresh, and PowerSync status */}
        <View style={{ backgroundColor: '#65435C', paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between bg-white py-4 px-4">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#65435C" />
            <Text className="text-[#65435C] font-bold text-lg ml-2">
              View All TD Notes
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-3">
            {/* PowerSync status indicator */}
            <View className="flex-row items-center">
              <View
                className={`h-2 w-2 rounded-full mr-1 ${
                  syncStatus ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <Text
                className={`text-xs font-semibold ${
                  syncStatus ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {syncStatus ? 'Online' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              className="px-3 py-1 rounded-full bg-[#65435C]/10"
            >
              <Text className="text-[#65435C] font-semibold text-base">🔄</Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Offline warning banner */}
        {!syncStatus && (
          <View className="mb-3 bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-2">
            <Text className="text-yellow-900 text-xs font-semibold">
              PowerSync disconnected. You can still work offline; changes will sync when the network is restored.
            </Text>
          </View>
        )}

        <View className="flex-row items-center justify-between gap-2 mb-4 h-14">
          <View className="relative w-[80%]">
            <View className="absolute left-3 top-4 z-10">
              <Search size={20} color="#65435C" />
            </View>
            <TextInput
              placeholder="Search by Doc No, Driver, etc."
              placeholderTextColor="#65435C" 
              className="text-white text-lg bg-[#937B8C] rounded-full p-4 pl-12 w-full"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
          <View className="items-center justify-center h-12 w-[20%]">
            <TouchableOpacity
              className="bg-white/20 rounded-full px-3 py-2"
              onPress={() => handleToggleFilter(filterMode === 'unvalidated' ? 'all' : 'unvalidated')}
            >
              <View className="flex-row items-center">
                <Filter size={18} color="white" />
                <Text className="text-white font-semibold text-xs ml-2">{filteredNotes.length}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-1 bg-white rounded-2xl p-4">
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-lg text-[#65435C]">Loading Delivery Notes...</Text>
            </View>
          ) : (
            <FlashList
              data={filteredNotes}
              renderItem={({ item }) => <NoteItem item={item} />}
              estimatedItemSize={100}
              keyboardShouldPersistTaps="handled"
            />
          )}
         
        </View>
      </View>
    </>
  );
};

// Reusable component for each item in the list (styled like growerItem)
const NoteItem = ({ item }: { item: TransporterDeliveryNote }) => {
    
    // Get the first two letters for the avatar, e.g., from Transporter Name
    const getInitials = (name?: string) => {
        if (!name) return 'DN';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    return (
        <TouchableOpacity 
          className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm" 
          onPress={() => router.push(`/receiving/transporter-details?id=${item.id}`)}
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    {/* Avatar circle with initials */}
                    <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
                        <Text className="text-white font-bold text-lg">
                            {getInitials(item.transporter_name)}
                        </Text>
                    </View>
                    
                    <View>
                        <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">{item.transporter_name}</Text>
                        <Text className="text-gray-700 text-sm font-medium">{item.creditor} - {item.physical_dnote_number}</Text>
                        <Text className="text-gray-500 text-sm">{item.document_number} - Growers: {item.pending_validation_count || 0}</Text>
                    </View>
                </View>
                
                {/* Right side with action indicator */}
                <View className=" rounded-full h-8 w-8 items-center justify-center">
                  <CircleArrowRight size={24} color="#65435C" />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default ViewAllTDNotes;
