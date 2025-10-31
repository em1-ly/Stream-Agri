import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Archive, Calendar, DollarSign, Hash, MapPin, Package, User, Weight, Users } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord, BaleRecord } from '@/powersync/Schema';

type BaleWithId = BaleRecord & { id: string };

const GrowerDeliveryNoteDetailScreen = () => {
  const { id } = useLocalSearchParams();
  const [note, setNote] = useState<GrowerDeliveryNoteRecord | null>(null);
  const [bales, setBales] = useState<BaleWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof id !== 'string') return;

    const fetchNoteDetails = async () => {
      setLoading(true);
      try {
        // Fetch the delivery note
        const noteResult = await powersync.get<GrowerDeliveryNoteRecord>(
          'SELECT * FROM receiving_grower_delivery_note WHERE id = ?',
          [id]
        );
        setNote(noteResult);

        // Fetch associated bales
        if (noteResult) {
          const balesResult = await powersync.getAll<BaleWithId>(
            'SELECT * FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ? ORDER BY lot_number ASC',
            [noteResult.id, noteResult.document_number]
          );
          setBales(balesResult);
        }
      } catch (error) {
        console.error('Failed to fetch delivery note details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNoteDetails();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="mt-4 text-lg text-gray-600">Loading Note...</Text>
      </View>
    );
  }

  if (!note) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Note Not Found' }} />
        <Text className="text-2xl font-bold text-red-600">Error</Text>
        <Text className="mt-2 text-lg text-gray-700 text-center">
          Could not find the Grower Delivery Note. It might have been deleted or there was a sync error.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Stack.Screen options={{title: 'Grower Delivery Note', headerShown: true }} />
      
      {/* Header Card */}
      <View className="bg-[#65435C] p-6 shadow-lg">
        <Text className="text-2xl font-bold text-white">{note.document_number}</Text>
        <Text className="text-lg text-white/80 mt-1">{note.grower_name}</Text>
        <View className="flex-row items-center mt-2">
          <View className="bg-white/20 rounded-full px-3 py-1">
            <Text className="text-white font-bold capitalize">{note.state}</Text>
          </View>
        </View>
      </View>
      
      {/* Details Section */}
      <View className="p-4">
        <Text className="text-xl font-bold text-gray-800 mb-4">Details</Text>
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <DetailRow icon={<User size={18} color="#65435C" />} label="Grower Number" value={note.grower_number} />
          <DetailRow icon={<Archive size={18} color="#65435C" />} label="Bales Captured" value={note.number_of_bales || 0} />
          <DetailRow icon={<Package size={18} color="#65435C" />} label="Bales Delivered" value={note.number_of_bales_delivered || 0} />
          <DetailRow icon={<MapPin size={18} color="#65435C" />} label="Location" value={note.location_id} />
          <DetailRow icon={<Calendar size={18} color="#65435C" />} label="Selling Date" value={note.selling_date ? new Date(note.selling_date).toLocaleDateString() : 'N/A'} />
        </View>
      </View>

      {/* Bales List Section */}
      <View className="p-4 pt-0">
        <Text className="text-xl font-bold text-gray-800 mb-4">Bales ({bales.length})</Text>
        {bales.length > 0 ? (
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {bales.map((bale, index) => <BaleItem key={bale.id || index} bale={bale} />)}
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-6 items-center justify-center border border-gray-100">
            <Package size={32} color="#A0A0A0" />
            <Text className="text-lg text-gray-500 mt-4">No bales have been added yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// Helper component for detail rows
const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <View className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
    <View className="flex-row items-center">
      {icon}
      <Text className="text-base text-gray-700 ml-3">{label}</Text>
    </View>
    <Text className="text-base font-semibold text-gray-900">{value}</Text>
  </View>
);

// Helper component for bale items
const BaleItem = ({ bale }: { bale: BaleWithId }) => (
  <View className="flex-row justify-between items-center py-4 border-b border-gray-100">
    <View>
      <Text className="text-base font-semibold text-gray-800">{bale.scale_barcode || 'N/A'}</Text>
      <Text className="text-sm text-gray-500 mt-1">
        Lot: {bale.lot_number || 'N/A'}  ·  Group: {bale.group_number || 'N/A'}
      </Text>
    </View>
    <Text className="text-base font-bold text-[#65435C]">{bale.mass || 0} kg</Text>
  </View>
);

export default GrowerDeliveryNoteDetailScreen;