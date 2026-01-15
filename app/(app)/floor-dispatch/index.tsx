import { Link, Stack } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Truck, FileText, ChevronRight, Building } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { ResCompanyRecord } from '@/powersync/Schema';


const menuItems = [
    { id: '1', title: 'Dispatch Note', href: '/(app)/floor-dispatch/dispatch-note', icon: FileText },
    { id: '2', title: 'Initiate Dispatch', href: '/(app)/floor-dispatch/initiate-dispatch', icon: Truck },
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
                <View className="flex-row items-center">
                    <item.icon size={20} color="#333" />
                    <Text className="text-base text-gray-800 ml-4">{item.title}</Text>
                </View>
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

export default function FloorDispatchMenu() {
  return (
    <>
      <Stack.Screen options={{ title: 'Floor Dispatch' }} />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-1 bg-white rounded-2xl p-4">
          <MenuComponent />
        </View>
      </View>
    </>
  );
}
