import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Stack, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

const menuItems = [
  {
    id: '1',
    title: 'Warehouse Dispatch Note',
    href: '/inventory/dispatch/warehouse-dispatch-note',
  },
  {
    id: '2',
    title: 'Initiate Warehouse Dispatch',
    href: '/inventory/dispatch/initiate-warehouse-dispatch',
  },
  {
    id: '3',
    title: 'Initiate Process Run',
    href: '/inventory/dispatch/initiate-process-run',
  },
  {
    id: '4',
    title: 'Initiate Satellite Scan',
    href: '/inventory/dispatch/initiate-satellite-scan',
  },
  {
    id: '5',
    title: 'Dispatch Products',
    href: '/inventory/dispatch/dispatch-products',
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


