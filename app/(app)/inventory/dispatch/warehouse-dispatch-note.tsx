import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, InteractionManager } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { powersync, setupPowerSync } from '@/powersync/system';
import * as Haptics from 'expo-haptics';

type DispatchNote = {
  id: string;
  mobile_app_id?: string;
  reference?: string;
  warehouse_source_name?: string;
  warehouse_destination_name?: string;
  product_name?: string;
  instruction_name?: string;
  transport_name?: string;
  truck_reg?: string;
  truck_reg_number?: string;
  driver_name?: string;
  driver_cellphone?: string;
  state?: string;
  shipped_bales?: number;
  shipped_mass?: number;
  received_bales?: number;
  received_mass?: number;
  create_date?: string;
};

const DispatchNoteScreen = () => {
  const [notes, setNotes] = useState<DispatchNote[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    // Defer heavy operations until after interactions complete (critical for lower-end devices)
    const interaction = InteractionManager.runAfterInteractions(() => {
    setupPowerSync();
    const controller = new AbortController();
    
    powersync.watch(
      `SELECT
        dn.id,
        dn.mobile_app_id,
        dn.reference,
        dn.instruction_id,
        src.name as warehouse_source_name,
        dest.name as warehouse_destination_name,
        prod.name as product_name,
        inst.name as instruction_name,
        trans.name as transport_name,
        dn.truck_reg,
        dn.truck_reg_number,
        COALESCE(dn.driver_name, drv.name) as driver_name,
        COALESCE(dn.driver_cellphone, drv.cellphone) as driver_cellphone,
        dn.state,
        dn.create_date,
        dn.shipped_bales,
        dn.shipped_mass,
        dn.received_bales,
        dn.received_mass
       FROM warehouse_dispatch_note AS dn
       LEFT JOIN warehouse_warehouse AS src ON dn.warehouse_source_id = src.id
       LEFT JOIN warehouse_warehouse AS dest ON dn.warehouse_destination_id = dest.id
       LEFT JOIN warehouse_product AS prod ON dn.product_id = prod.id
       LEFT JOIN warehouse_instruction AS inst ON dn.instruction_id = inst.id
       LEFT JOIN warehouse_transport AS trans ON dn.transport_id = trans.id
       LEFT JOIN warehouse_driver AS drv ON dn.driver_id = drv.id
       ORDER BY dn.create_date DESC`,
      [],
      {
        onResult: (result) => {
          if (result.rows?._array) {
            const fetchedNotes = result.rows._array as DispatchNote[];
            setNotes(fetchedNotes);
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
    });
    
    return () => {
      interaction.cancel();
    };
  }, []);

  // Memoized filtered notes with debounced search
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return notes;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    return notes.filter(note => {
      const ref = note.reference?.toLowerCase() || '';
      const src = note.warehouse_source_name?.toLowerCase() || '';
      const dest = note.warehouse_destination_name?.toLowerCase() || '';
      const prod = note.product_name?.toLowerCase() || '';
      const inst = note.instruction_name?.toLowerCase() || '';
      return (
        ref.includes(lowercaseQuery) ||
        src.includes(lowercaseQuery) ||
        dest.includes(lowercaseQuery) ||
        prod.includes(lowercaseQuery) ||
        inst.includes(lowercaseQuery)
      );
    });
  }, [notes, searchQuery]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Debounce search updates (optional - for very large lists)
    // For now, we'll update immediately but use useMemo for filtering
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      await powersync.execute('SELECT 1');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.warn('⚠️ Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Warehouse Dispatch Notes', 
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
              placeholder="Search by Ref, Source, Destination, Product, Instruction..."
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
              estimatedItemSize={120}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              removeClippedSubviews={true}
              drawDistance={200}
              // Performance optimizations for lower-end devices
              overrideItemLayout={(layout, item, index) => {
                layout.size = 120; // Fixed item size for better performance
              }}
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

const DispatchNoteItem = React.memo(({ item }: { item: DispatchNote }) => {
  const router = useRouter();
  
  const initials = useMemo(() => {
    const name = item.warehouse_destination_name;
    if (!name) return 'WH';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [item.warehouse_destination_name]);

  const handlePress = useCallback(() => {
    // Navigate immediately (most important for perceived performance)
    router.push({
      pathname: '/(app)/inventory/dispatch/warehouse-dispatch-note-details',
      params: { id: item.mobile_app_id || item.id }
    });
    
    // Haptic feedback after navigation (non-blocking, deferred for lower-end devices)
    setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Silently fail on devices that don't support haptics
        });
      } catch (e) {
        // Ignore haptic errors
      }
    }, 0);
  }, [router, item.mobile_app_id, item.id]);

  const stateStyle = useMemo(() => {
    if (item.state === 'draft') {
      return 'bg-yellow-100 text-yellow-800';
    } else if (item.state === 'posted') {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  }, [item.state]);

  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg">
              {initials}
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold text-[#65435C] truncate max-w-[220px]">
              {item.warehouse_destination_name || 'Destination Warehouse'}
            </Text>
            <Text className="text-gray-500 text-sm">
              {item.reference || 'No Ref'}
            </Text>
            <Text className="text-gray-500 text-sm">
              Product1: {item.product_name || 'N/A'}
            </Text>
            <Text className="text-gray-500 text-sm">
              Instruction: {item.instruction_name || 'N/A'}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${stateStyle}`}>
            {(item.state || 'N/A').toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default DispatchNoteScreen;


