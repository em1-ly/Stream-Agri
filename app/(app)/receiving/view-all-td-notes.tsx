import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { CircleArrowRight, PlugZap, Search, Unplug, FilePlus } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/system';

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
};

const ViewAllTDNotes = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<TransporterDeliveryNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<TransporterDeliveryNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(false);

  // Set up PowerSync listener
  useFocusEffect(
    useCallback(() => {
      powersync.registerListener({
        statusChanged: (status) => setSyncStatus(status.connected),
      });
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
            const notes = result.rows._array as TransporterDeliveryNote[];
            setDeliveryNotes(notes);
            setFilteredNotes(notes);
          }
          setLoading(false);
        },
        onError: (err) => {r
          console.error('Error fetching delivery notes:', err);
          setLoading(false);
        }
      },
      { signal: controller.signal}
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
        note.name?.toLowerCase().includes(lowercaseQuery) || // Driver name
        note.transporter_name?.toLowerCase().includes(lowercaseQuery) ||
        note.vehicle_registration?.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredNotes(filtered);
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'All TD Notes',
        headerTitleStyle: { fontSize: 24, fontWeight: 'bold', color: '#65435C' },
        headerShown: true,
        headerRight: () => (
            <View className="mr-4 flex-row items-center gap-2">
                <TouchableOpacity onPress={() => console.log('refreshing')}>
                  {syncStatus ? (
                    <PlugZap size={24} color="#1AD3BB" />
                  ) : (
                    <Unplug size={24} color="red" />
                  )}
                </TouchableOpacity>
            </View>
        )
      }} />
      <View className="flex-1 p-4 bg-[#65435C]">
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
          <View className="flex-row items-center justify-center h-12 w-[20%]">
            <Text className="text-white font-bold text-2xl text-center">{filteredNotes.length}</Text>
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
          {/* Create New Button */}
          <TouchableOpacity 
            onPress={() => router.push('/receiving/new-transporter-dnote')}
            className="bg-[#65435C] p-3 rounded-md mt-2"
          >
            <View className="flex-row items-center justify-center">
              <FilePlus size={24} color="white" />
              <Text className="text-white text-center text-lg ml-4">New Delivery Note</Text>
            </View>
          </TouchableOpacity>
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
          // onPress={() => router.push(...)} // Add navigation to a detail view later
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
                        <Text className="text-gray-500 text-sm">{item.document_number} - Bales: {item.number_of_bales || 0}</Text>
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