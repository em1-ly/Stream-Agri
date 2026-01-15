import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Stack, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';


// Menu Component
const menuItems = [
  { id: '1', title: 'Complete Receipt', href: '/inventory/receive/complete-receipt' },
  { id: '2', title: 'Receive New', href: '/inventory/receive/receive-new' },
  { id: '3', title: 'Receipt Notes', href: '/inventory/receive/receipt-notes' },
  
];

const MenuComponent = () => {
    const renderItem = ({ item }: { item: typeof menuItems[0] }) => (
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


// --- The main screen component ---

export default function ReceivingScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Receive' }} />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-1 bg-white rounded-2xl p-4">
          <MenuComponent />
        </View>
      </View>
    </>
  );
}