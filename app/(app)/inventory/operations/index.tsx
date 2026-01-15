import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Stack, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

const menuItems = [
  {
    id: '1',
    title: 'Stack Bales',
    href: '/(app)/inventory/operations/stack-bales',
  },
  {
    id: '2',
    title: 'Rack Loading',
    href: '/(app)/inventory/operations/rack-loading',
  },
  {
    id: '3',
    title: 'Reclassify Bales',
    href: '/(app)/inventory/operations/reclassify-bales',
  },
  {
    id: '4',
    title: 'Remove Bales from Rack',
    href: '/(app)/inventory/operations/remove-bales-from-rack',
  },
  {
    id: '5',
    title: 'Bale History Query',
    href: '/(app)/inventory/operations/bale-history-query',
  },
  {
    id: '6',
    title: 'Bale Reticketing',
    href: '/(app)/inventory/operations/bale-reticketing',
  },
  {
    id: '7',
    title: 'Ticketing',
    href: '/(app)/inventory/operations/ticketing',
  },
];

const MenuComponent = () => {
  const renderItem = ({ item }: { item: (typeof menuItems)[0] }) => (
    <Link href={item.href as any} asChild>
      <TouchableOpacity className="flex-row justify-between items-center py-4 px-2">
        <Text className="text-base text-gray-800">{item.title}</Text>
        <ChevronRight color="#65435C" size={20} />
      </TouchableOpacity>
    </Link>
  );

  return (
    <FlatList
      data={menuItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-2" />}
    />
  );
};

export default function InventoryDispatchScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Dispatch' }} />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-1 bg-white rounded-2xl p-4">
          <MenuComponent />
        </View>
      </View>
    </>
  );
}


