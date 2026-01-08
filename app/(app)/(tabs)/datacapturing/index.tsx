import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Link } from 'expo-router';
import { ChevronRight, Building } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { ResCompanyRecord } from '@/powersync/Schema';

const menuItems = [
  { id: '1', title: 'Classification', href: '/(app)/datacapturing/classification' },
  { id: '2', title: 'Buyer Details', href: '/(app)/datacapturing/buyer-details' },
  { id: '3', title: 'Arbitration', href: '/(app)/datacapturing/abitration' },
  { id: '4', title: 'Release', href: '/(app)/datacapturing/all-details' },

];

const MenuComponent = () => {
  const [companyInfo, setCompanyInfo] = useState<ResCompanyRecord | null>(null);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      const companyInfo = await powersync.execute(`SELECT * FROM res_company LIMIT 1`);
      setCompanyInfo(companyInfo.rows?._array?.[0] || null);
    };
    fetchCompanyInfo();
  }, []);

  const renderItem = ({ item }: { item: typeof menuItems[0] }) => (
    <Link href={item.href as any} asChild>
      <TouchableOpacity className="flex-row justify-between items-center py-4 px-2">
        <Text className="text-base text-gray-800">{item.title}</Text>
        <ChevronRight color="#65435C" size={20} />
      </TouchableOpacity>
    </Link>
  );

  return (
    <View className="flex-1">
      {companyInfo && (
        <View className="flex-row items-center gap-2 mb-4 px-2">
          <Building size={20} color="#65435C" />
          <Text className="text-sm font-medium text-gray-600">{companyInfo.name}</Text>
        </View>
      )}
      <FlatList
        data={menuItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-2" />}
      />
    </View>
  );
};

export default function DataCapturingScreen() {
  return (
    <View className="flex-1 p-4 bg-[#65435C]">
      <View className="flex-1 bg-white rounded-2xl p-4">
        <MenuComponent />
      </View>
    </View>
  );
}

