import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/system';

type ReceiptNote = {
  id: string;
  mobile_app_id?: string;
  origin?: string;
  destination_name?: string;
  state?: string;
  dnote_date?: string;
  total_bales?: number;
  received_bales?: number;
  reference?: string;
};

const ReceiptNotesScreen = () => {
  const [notes, setNotes] = useState<ReceiptNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<ReceiptNote[]>([]);
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
        dn.origin,
        dest.name as destination_name,
        dn.state,
        dn.dnote_date,
        dn.total_bales,
        dn.received_bales
       FROM warehouse_delivery_note AS dn
       LEFT JOIN warehouse_warehouse AS dest ON dn.destination_id = dest.id
       ORDER BY dn.dnote_date DESC NULLS LAST, dn.create_date DESC`,
      [],
      {
        onResult: (result) => {
          if (result.rows?._array) {
            const fetchedNotes = result.rows._array as ReceiptNote[];
            setNotes(fetchedNotes);
            setFilteredNotes(fetchedNotes);
          }
          setLoading(false);
        },
        onError: (err) => {
          console.error('Error fetching receipt notes:', err);
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
        note.origin?.toLowerCase().includes(lowercaseQuery) ||
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
      <Stack.Screen
        options={{
          title: 'Receipt Notes',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleRefresh}
              className="mr-4 p-2"
            >
              <Text className="text-[#65435C] font-semibold text-lg">🔄</Text>
            </TouchableOpacity>
          )
        }}
      />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-row items-center justify-between gap-2 mb-4 h-14">
          <View className="relative w-[80%]">
            <View className="absolute left-3 top-4 z-10">
              <Search size={20} color="#65435C" />
            </View>
            <TextInput
              placeholder="Search by Ref, Origin, Destination..."
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
              renderItem={({ item }) => <ReceiptNoteItem item={item} />}
              estimatedItemSize={100}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center mt-20">
                  <Text className="text-gray-600">No receipt notes found.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </>
  );
};

const ReceiptNoteItem = ({ item }: { item: ReceiptNote }) => {
  const getInitials = (origin?: string) => {
    if (!origin) return 'OR';
    return origin.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const allReceived = (item.total_bales ?? 0) > 0 && item.total_bales === item.received_bales;

  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
      onPress={() => {
        // Navigate to detail screen that mirrors the Odoo form
        // We pass the internal id (PowerSync primary key) to look up the record locally
        // If you later add mobile_app_id to this table, you can prefer that here
        // like in the dispatch note screens.
        // @ts-ignore - router is available via expo-router at runtime
        const { router } = require('expo-router');
        router.push({
          pathname: '/(app)/inventory/receive/receipt-note-detail',
          params: { id: item.id },
        });
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg">
              {getInitials(item.origin)}
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">
              {item.origin || 'Unknown Origin'}
            </Text>
            <Text className="text-gray-500 text-sm">
              {item.reference} - Bales: {item.received_bales || 0}/{item.total_bales || 0}
            </Text>
            <Text className="text-gray-400 text-xs">
              Dest: {item.destination_name || 'N/A'}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              allReceived ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {(item.state || 'N/A').toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ReceiptNotesScreen;


