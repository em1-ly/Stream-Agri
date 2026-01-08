import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, Calendar, MapPin, Package, User, Edit2, ChevronDown } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { GrowerDeliveryNoteRecord, BaleRecord } from '@/powersync/Schema';

type BaleWithId = BaleRecord & { id: string };

const GrowerDeliveryNoteDetailScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<GrowerDeliveryNoteRecord | null>(null);
  const [bales, setBales] = useState<BaleWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosingDelivery, setIsClosingDelivery] = useState(false);
  const [balesCollapsed, setBalesCollapsed] = useState(true); // collapsed by default

  // Expected bale count from note (delivered overrides planned)
  const expectedBales =
    (note?.number_of_bales_delivered as number | undefined) ??
    (note?.number_of_bales as number | undefined) ??
    0;

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

  // Refresh bales when screen comes into focus (e.g., returning from edit screen)
  useFocusEffect(
    useCallback(() => {
      const refreshBales = async () => {
        if (!note) return;
        try {
          const balesResult = await powersync.getAll<BaleWithId>(
            'SELECT * FROM receiving_bale WHERE grower_delivery_note_id = ? OR document_number = ? ORDER BY lot_number ASC',
            [note.id, note.document_number]
          );
          setBales(balesResult);
        } catch (error) {
          console.error('Failed to refresh bales:', error);
        }
      };
      refreshBales();
    }, [note])
  );

  const handleCloseDelivery = async () => {
    if (!note) return;

    const noteState = (note.state || '').toLowerCase();
    if (noteState === 'checked') {
      Alert.alert(
        'Already Closed',
        `Delivery note ${note.document_number} is already closed.`
      );
      return;
    }

    const actualBales = bales.length;

    if (!expectedBales || expectedBales <= 0) {
      Alert.alert(
        'Cannot Close',
        'Expected bale count is not set on this delivery note. Please ensure the number of bales is captured before closing.'
      );
      return;
    }

    if (actualBales < expectedBales) {
      Alert.alert(
        'Cannot Close',
        `Cannot close delivery note: Only ${actualBales} out of ${expectedBales} expected bales have been captured.\n\nPlease capture all bales before closing.`
      );
      return;
    }

    setIsClosingDelivery(true);
    try {
      const writeDate = new Date().toISOString();
      await powersync.execute(
        'UPDATE receiving_grower_delivery_note SET state = ?, write_date = ? WHERE id = ?',
        ['checked', writeDate, note.id]
      );

      // Update local state to reflect closed status
      setNote({
        ...note,
        state: 'checked',
        write_date: writeDate as any,
      });

      Alert.alert(
        '✅ Delivery Closed',
        `Delivery note ${note.document_number} has been closed successfully.\n\nBales: ${actualBales}/${expectedBales}`,
      );
    } catch (error: any) {
      console.error('Failed to close delivery note from detail screen', error);
      Alert.alert(
        'Error',
        `Failed to close delivery note:\n${error?.message || 'Unknown error'}`
      );
    } finally {
      setIsClosingDelivery(false);
    }
  };

  const handleEditBale = (bale: BaleWithId) => {
    // Validate bale can be edited (must be in 'open' state)
    if (bale.state !== 'open') {
      Alert.alert(
        'Cannot Edit',
        `Cannot edit bale in state '${bale.state}'. Only bales in 'open' state can be edited.`
      );
      return;
    }
    
    // Navigate to edit bale screen
    router.push({
      pathname: '/receiving/edit-bale',
      params: {
        baleId: bale.id,
        deliveryNoteId: note?.id || ''
      }
    });
  };

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
      <Stack.Screen 
        options={{
          title: "", // Remove overlapping title
          headerShown: true,
          headerTransparent: true, // Make it transparent so our custom card background works
        }} 
      />
      
      {/* Header Card - Added top padding to account for transparent header */}
      <View 
        className="bg-white p-6 shadow-sm border-b border-gray-100"
        style={{ paddingTop: insets.top + 40 }} 
      >
        <Text className="text-2xl font-bold text-gray-900">{note.document_number}</Text>
        <Text className="text-lg text-gray-600 mt-1">{note.grower_name}</Text>
        <View className="flex-row items-center mt-2">
          <View className="bg-[#65435C]/10 rounded-full px-3 py-1">
            <Text className="text-[#65435C] font-bold capitalize text-xs">{note.state}</Text>
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

      {/* Bales List Section (collapsible) */}
      <View className="p-4 pt-0">
        <TouchableOpacity
          className="flex-row items-center justify-between mb-2"
          onPress={() => setBalesCollapsed(prev => !prev)}
        >
          <Text className="text-xl font-bold text-gray-800">
            Bales ({bales.length})
          </Text>
          <ChevronDown
            size={20}
            color="#65435C"
            style={{
              transform: [{ rotate: balesCollapsed ? '0deg' : '180deg' }],
            }}
          />
        </TouchableOpacity>

        {!balesCollapsed && (
          <>
            {bales.length > 0 ? (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                {bales.map((bale, index) => (
                  <BaleItem 
                    key={bale.id || index} 
                    bale={bale} 
                    onEdit={() => handleEditBale(bale)}
                  />
                ))}
              </View>
            ) : (
              <View className="bg-white rounded-2xl p-6 items-center justify-center border border-gray-100">
                <Package size={32} color="#A0A0A0" />
                <Text className="text-lg text-gray-500 mt-4">No bales have been added yet.</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Close Delivery Button */}
      <View className="p-4 pt-0 mb-6">
        <TouchableOpacity
          onPress={handleCloseDelivery}
          disabled={
            isClosingDelivery ||
            (note.state || '').toLowerCase() === 'checked' ||
            bales.length < expectedBales
          }
          className={`py-4 rounded-xl items-center ${
            isClosingDelivery ||
            (note.state || '').toLowerCase() === 'checked' ||
            bales.length < expectedBales
              ? 'bg-gray-200'
              : 'bg-[#65435C]'
          }`}
        >
          <Text
            className={`text-base font-bold ${
              isClosingDelivery ||
              (note.state || '').toLowerCase() === 'checked' ||
              bales.length < expectedBales
                ? 'text-gray-500'
                : 'text-white'
            }`}
          >
            {isClosingDelivery
              ? 'Closing Delivery...'
              : (note.state || '').toLowerCase() === 'checked'
              ? 'Delivery Closed'
              : `Close Delivery (${bales.length}/${expectedBales})`}
          </Text>
        </TouchableOpacity>
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
const BaleItem = ({ bale, onEdit }: { bale: BaleWithId; onEdit: () => void }) => (
  <View className="flex-row justify-between items-center py-4 border-b border-gray-100">
    <View className="flex-1">
      <Text className="text-base font-semibold text-gray-800">{bale.scale_barcode || 'N/A'}</Text>
      <Text className="text-sm text-gray-500 mt-1">
        Lot: {bale.lot_number || 'N/A'}  ·  Group: {bale.group_number || 'N/A'}
      </Text>
      {bale.state !== 'open' && (
        <Text className="text-xs text-gray-400 mt-1 capitalize">State: {bale.state}</Text>
      )}
    </View>
    <View className="flex-row items-center gap-3">
      <Text className="text-base font-bold text-[#65435C]">{bale.mass || 0} kg</Text>
      {bale.state === 'open' && (
        <TouchableOpacity
          onPress={onEdit}
          className="p-2 bg-gray-100 rounded-lg"
        >
          <Edit2 size={18} color="#65435C" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

export default GrowerDeliveryNoteDetailScreen;

