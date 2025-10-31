import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Building } from 'lucide-react-native';
import { useSession } from '@/authContext';
import { powersync } from '@/powersync/system';
import { ResCompanyRecord } from '@/powersync/Schema';

const DataCapturingMenu = () => {
  const router = useRouter();
  const { signOut } = useSession();
  const [companyInfo, setCompanyInfo] = useState<ResCompanyRecord | null>(null);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      const companyInfo = await powersync.execute(`SELECT * FROM res_company LIMIT 1`);
      setCompanyInfo(companyInfo.rows?._array?.[0] || null);
    };
    fetchCompanyInfo();
  }, []);

  const menuItems = [
    { title: 'Classification', route: '/(app)/datacapturing/classification' },
    { title: 'Buyer Details', route: '/(app)/datacapturing/buyer-details' },
    { title: 'Releaase', route: '/(app)/datacapturing/all-details' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-4 mt-12">
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className='flex flex-row items-center gap-2'>
            <Building size={25} color="#1AD3BB" />
            <Text className="text-xl font-bold text-[#65435C]">
              Data Capturing - {companyInfo?.name}
            </Text>
          </View>
        </View>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            className="bg-white rounded-lg p-4 mb-3 flex-row justify-between items-center shadow-sm"
            onPress={() => router.push(item.route as any)}
          >
            <Text className="text-lg text-gray-800">{item.title}</Text>
            <ChevronRight size={20} color="#65435C" />
          </TouchableOpacity>
        ))}

        <View className="mt-4 border-t-2 border-gray-200 pt-4">
          <TouchableOpacity
            className="bg-white rounded-lg p-4 flex-row justify-center items-center shadow-sm"
            onPress={() => signOut()}
          >
            <LogOut size={20} color="teal" />
            <Text className="text-lg text-teal-500 ml-2 font-semibold">Log Out of System</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default DataCapturingMenu;
