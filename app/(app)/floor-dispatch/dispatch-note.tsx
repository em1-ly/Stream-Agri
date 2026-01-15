import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/system';

type DispatchNote = {
  id: string;
  mobile_app_id?: string;
  warehouse_destination_id?: string;
  destination_name?: string;
  state?: string;
  create_date?: string;
  total_bales?: number;
  reference?: string;
};

const DispatchNoteScreen = () => {
  const [notes, setNotes] = useState<DispatchNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<DispatchNote[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          await powersync.execute('SELECT 1'); // Trigger sync
        } catch (e) {
          console.warn('⚠️ PowerSync sync failed:', e);
        }
      };
      refreshData();
    }, [])
  );

  useEffect(() => {
    setupPowerSync();
    const controller = new AbortController();
    
    powersync.watch(
      `SELECT
        dn.id,
        dn.reference,
        dn.mobile_app_id,
        dn.warehouse_destination_id,
        wh.name as destination_name,
        dn.state,
        dn.create_date,
        (SELECT COUNT(*) FROM floor_dispatch_bale WHERE dispatch_note_id = dn.id) as total_bales
       FROM floor_dispatch_note AS dn
       LEFT JOIN warehouse_warehouse AS wh ON dn.warehouse_destination_id = wh.id
       ORDER BY dn.create_date DESC`,
      [],
      {
        onResult: (result) => {
          if (result.rows?._array) {
            const fetchedNotes = result.rows._array as DispatchNote[];
            setNotes(fetchedNotes);
            setFilteredNotes(fetchedNotes);
          }
          setLoading(false);
        },
        onError: (err) => {
          console.error('Error fetching dispatch notes:', err);
          setLoading(false);
        }
      },
      { signal: controller.signal }
    );
    
    return () => controller.abort();
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredNotes(notes);
      return;
    }

    const lowercaseQuery = text.toLowerCase();
    const filtered = notes.filter(
      note => 
        note.reference?.toLowerCase().includes(lowercaseQuery) ||
        note.destination_name?.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredNotes(filtered);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await powersync.execute('SELECT 1');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.warn('⚠️ Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-row items-center justify-between gap-2 mb-4 h-14">
          <View className="relative w-[80%]">
            <View className="absolute left-3 top-4 z-10">
              <Search size={20} color="#65435C" />
            </View>
            <TextInput
              placeholder="Search by Ref, Destination..."
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
              <ActivityIndicator size="large" color="#65435C" />
              <Text className="text-lg text-[#65435C] mt-2">Loading Notes...</Text>
            </View>
          ) : (
            <FlashList
              data={filteredNotes}
              renderItem={({ item }) => <DispatchNoteItem item={item} />}
              estimatedItemSize={100}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center mt-20">
                  <Text className="text-gray-600">No dispatch notes found.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </>
  );
};

const DispatchNoteItem = ({ item }: { item: DispatchNote }) => {
    const getInitials = (name?: string) => {
        if (!name) return 'WH';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    return (
        <TouchableOpacity 
          className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm" 
          onPress={() => router.push({ pathname: '/(app)/floor-dispatch/dispatch-note-detail', params: { id: item.mobile_app_id || item.id } })}
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
                        <Text className="text-white font-bold text-lg">
                            {getInitials(item.destination_name)}
                        </Text>
                    </View>
                    
                    <View>
                        <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">{item.destination_name}</Text>
                        <Text className="text-gray-500 text-sm">{item.reference} - Bales: {item.total_bales || 0}</Text>
                    </View>
                </View>
                
                <View className="items-end">
                    <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.state === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      item.state === 'posted' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                        {(item.state || 'N/A').toUpperCase()}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default DispatchNoteScreen;
