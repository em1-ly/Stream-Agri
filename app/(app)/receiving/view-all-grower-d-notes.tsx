import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { CircleArrowRight, PlugZap, Search, Unplug, FilePlus, ChevronLeft } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/setup';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define the type for a Grower Delivery Note.
// Note the more detailed state type.
type GrowerDeliveryNote = {
  id: string;
  document_number?: string;
  grower_id?: number;
  grower_number?: string;
  grower_name?: string;
  number_of_bales?: number;
  number_of_bales_delivered?: number;
  sale_date?: string;
  create_date?: string;
  state?: 'open' | 'printing' | 'laying' | 'checked' | 'closed' | 'blocked' | 'scheduling' | 'pending';
};

const ViewAllGrowerDNotes = () => {
  const insets = useSafeAreaInsets();
  const [deliveryNotes, setDeliveryNotes] = useState<GrowerDeliveryNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<GrowerDeliveryNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(!!powersync.currentStatus?.connected);

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
          await powersync.execute('SELECT 1'); // Trigger sync
          console.log('🔄 PowerSync sync triggered on focus');
        } catch (e) {
          console.warn('⚠️ PowerSync sync failed:', e);
        }
      };
      refreshData();
    }, [])
  );

  // Fetch data from PowerSync with the required filters
  useEffect(() => {
    setupPowerSync();
    const controller = new AbortController();
    
    // This query now includes your business rules:
    // 1. WHERE state != 'laid'
    // 2. WHERE create_date is in the current year
    const currentYear = new Date().getFullYear().toString();
    powersync.watch(
      `SELECT * FROM receiving_grower_delivery_note 
       WHERE state != 'laid' AND strftime('%Y', create_date) = ?
       ORDER BY document_number DESC`,
      [currentYear],
      {
        onResult: (result) => {
          if (result.rows?._array) {
            const notes = result.rows._array as GrowerDeliveryNote[];
            setDeliveryNotes(notes);
            setFilteredNotes(notes);
          }
          setLoading(false);
        },
        onError: (err) => {
          console.error('Error fetching grower delivery notes:', err);
          setLoading(false);
        }
      },
      { signal: controller.signal }
    );
    
    return () => controller.abort();
  }, []);

  // Handle search functionality
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredNotes(deliveryNotes);
      return;
    }

    const lowercaseQuery = text.toLowerCase();
    const filtered = deliveryNotes.filter(
      note => 
        note.document_number?.toLowerCase().includes(lowercaseQuery) ||
        note.grower_name?.toLowerCase().includes(lowercaseQuery) ||
        note.grower_number?.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredNotes(filtered);
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
          <View className="flex-row justify-between bg-white py-4 px-4">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#65435C" />
            <Text className="text-[#65435C] font-bold text-lg ml-2">
              View All Grower D Notes
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
              placeholder="Search by Doc No, Grower Name..."
              placeholderTextColor="#65435C" 
              className="text-white text-lg bg-[#937B8C] rounded-full p-4 pl-12 w-full"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
          <View className="flex-row items-center justify-center h-12 w-[20%]">
            <Text className="text-white font-bold text-2xl text-center">{filteredNotes.length}</Text>
          </View>
        </View>

        <View className="flex-1 bg-white rounded-2xl p-4">
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-lg text-[#65435C]">Loading Grower Notes...</Text>
            </View>
          ) : (
            <FlashList
              data={filteredNotes}
              renderItem={({ item }) => <GrowerNoteItem item={item} />}
              estimatedItemSize={100}
              keyboardShouldPersistTaps="handled"
            />
          )}
          
        </View>
      </View>
    </>
  );
};

// Reusable component for each item in the list
const GrowerNoteItem = ({ item }: { item: GrowerDeliveryNote }) => {
    
    const getInitials = (name?: string) => {
        if (!name) return 'GN';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    return (
        <TouchableOpacity 
          className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm" 
          onPress={() => router.push(`/receiving/${item.id}`)}
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
                        <Text className="text-white font-bold text-lg">
                            {getInitials(item.grower_name)}
                        </Text>
                    </View>
                    
                    <View>
                        <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">{item.grower_name}</Text>
                        <Text className="text-gray-500 text-sm">{item.document_number} - Bales: {item.number_of_bales_delivered || 0}</Text>
                    </View>
                </View>
                
                <View className="items-end">
                    <Text className="text-gray-500 text-xs font-semibold uppercase">{item.state}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default ViewAllGrowerDNotes;
