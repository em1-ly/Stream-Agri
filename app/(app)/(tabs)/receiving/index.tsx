import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { Stack, Link, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Users, Archive, TrendingUp, Database, TrendingDown, BarChart3, Calendar, MapPin, CheckCircle, DollarSign } from 'lucide-react-native';

// --- Re-usable components for the tabs ---

// Progress Bar Component
const ProgressBar = ({ value, total, color = 'bg-[#65435C]' }: { value: number; total: number; color?: string }) => {
  const percentage = (value / total) * 100;
  return (
    <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <View className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
    </View>
  );
};

// Metric Card Component
const MetricCard = ({ icon, value, label, color = '#65435C', trend }: { icon: React.ReactNode; value: string; label: string; color?: string; trend?: string }) => (
  <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
    <View className="flex-row items-center justify-between mb-2">
      <View className="bg-gray-50 p-2 rounded-xl">
        {icon}
      </View>
      {trend && (
        <Text className="text-xs font-semibold text-green-600">{trend}</Text>
      )}
    </View>
    <Text className="text-2xl font-bold text-gray-800 mt-1">{value}</Text>
    <Text className="text-sm text-gray-500 mt-1">{label}</Text>
  </View>
);

// Status Item Component
const StatusItem = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => (
  <View className="mb-3">
    <View className="flex-row justify-between items-center mb-1">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <Text className="text-sm font-bold text-gray-800">{value}/{total}</Text>
    </View>
    <ProgressBar value={value} total={total} color={color} />
  </View>
);

// Dashboard Component
const DashboardComponent = () => (
  <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
    {/* Header Stats */}
    <View className="mb-4">
      <Text className="text-lg font-bold text-gray-800 mb-3">Overview</Text>
      <View className="flex-row gap-3">
        <MetricCard
          icon={<Users size={20} color="#65435C" />}
          value="1,250"
          label="Growers"
          trend="+12%"
        />
        <MetricCard
          icon={<Archive size={20} color="#65435C" />}
          value="15.8K"
          label="Bales"
          trend="+8%"
        />
      </View>
    </View>

    {/* Current Sale Info */}
    <View className="bg-[#65435C] rounded-2xl p-5 mb-4 shadow-lg">
      <View className="flex-row items-center mb-3">
        <Calendar size={18} color="#FFF" />
        <Text className="text-white font-bold text-base ml-2">Sale Day: 2025-10-02</Text>
      </View>
      <View className="flex-row items-center mb-3">
        <MapPin size={18} color="#FFF" />
        <Text className="text-white/90 text-sm ml-2">Main Floor • Mashonaland West • Karoi • Tengwe</Text>
      </View>
      <View className="h-px bg-white/30 my-3" />
      <View className="flex-row justify-between">
        <View className="flex-1">
          <Text className="text-white/70 text-xs mb-1">Completion</Text>
          <Text className="text-white font-bold text-xl">83%</Text>
        </View>
        <View className="flex-1 items-end">
          <Text className="text-white/70 text-xs mb-1">Received/Booked</Text>
          <Text className="text-white font-bold text-xl">250/300</Text>
        </View>
      </View>
    </View>

    {/* Receiving Status */}
    {/* <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
      <Text className="text-base font-bold text-gray-800 mb-4">Receiving Status</Text>
      <StatusItem label="Booked" value={300} total={300} color="bg-blue-500" />
      <StatusItem label="Received" value={250} total={300} color="bg-green-500" />
      <StatusItem label="Released" value={245} total={300} color="bg-purple-500" />
      <StatusItem label="Paid" value={240} total={300} color="bg-[#65435C]" />
    </View> */}

    {/* Sale Day Summary */}
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
      <Text className="text-base font-bold text-gray-800 mb-4">Sale Day Summary</Text>
      
      <View className="flex-row flex-wrap gap-3">
        {/* Bales Laid */}
        <View className="flex-1 min-w-[45%] bg-green-50 rounded-xl p-3">
          <TrendingUp size={18} color="#10B981" />
          <Text className="text-lg font-bold text-gray-800 mt-2">5,200</Text>
          <Text className="text-xs text-gray-600 mt-1">Bales Laid</Text>
        </View>

        {/* Bales Purchased */}
        <View className="flex-1 min-w-[45%] bg-blue-50 rounded-xl p-3">
          <Database size={18} color="#3B82F6" />
          <Text className="text-lg font-bold text-gray-800 mt-2">4,800</Text>
          <Text className="text-xs text-gray-600 mt-1">Bales Purchased</Text>
        </View>

        {/* Bales Rejected */}
        <View className="flex-1 min-w-[45%] bg-red-50 rounded-xl p-3">
          <TrendingDown size={18} color="#EF4444" />
          <Text className="text-lg font-bold text-gray-800 mt-2">400</Text>
          <Text className="text-xs text-gray-600 mt-1">Bales Rejected</Text>
        </View>

        {/* Volume */}
        <View className="flex-1 min-w-[45%] bg-purple-50 rounded-xl p-3">
          <BarChart3 size={18} color="#8B5CF6" />
          <Text className="text-lg font-bold text-gray-800 mt-2">480K kg</Text>
          <Text className="text-xs text-gray-600 mt-1">Volume Purchased</Text>
        </View>

        {/* Average Price */}
        <View className="w-full bg-[#65435C]/5 rounded-xl p-3">
          <View className="flex-row items-center">
            <DollarSign size={18} color="#65435C" />
            <Text className="text-xs text-gray-600 ml-1">Average Price</Text>
          </View>
          <Text className="text-2xl font-bold text-[#65435C] mt-1">$2.50/kg</Text>
        </View>
      </View>
    </View>
  </ScrollView>
);

// Menu Component
const menuItems = [
  { id: '2', title: 'Validate Transporter Delivery Notes', href: '/receiving/view-all-td-notes' },
  { id: '3', title: 'Check Grower Delivery Notes', href: '/receiving/view-all-grower-d-notes' },
  { id: '4', title: 'Marshalling', href: '/receiving/add-bale-to-gd-note' },
  { id: '5', title: 'Sequencing Scanner', href: '/receiving/sequencing-scanner' },
  // { id: '6', title: 'Resequencing', href: '/receiving/bale-resequencing' },
  
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
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu'>('dashboard');

  // Initialize active tab from route param (e.g. /receiving?tab=menu)
  useEffect(() => {
    const tabParam = (params?.tab as string | undefined)?.toLowerCase();
    if (tabParam === 'menu') {
      setActiveTab('menu');
    } else if (tabParam === 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [params?.tab]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 p-4 bg-[#65435C]">
        <View className="flex-1 bg-white rounded-2xl p-4">
          {/* Tab Switcher */}
          <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-[#65435C]' : ''}`}
              onPress={() => setActiveTab('dashboard')}
            >
              <Text className={`text-center font-semibold ${activeTab === 'dashboard' ? 'text-white' : 'text-[#65435C]'}`}>
                Dashboard
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${activeTab === 'menu' ? 'bg-[#65435C]' : ''}`}
              onPress={() => setActiveTab('menu')}
            >
               <Text className={`text-center font-semibold ${activeTab === 'menu' ? 'text-white' : 'text-[#65435C]'}`}>
                Menu
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Content based on active tab */}
          {activeTab === 'dashboard' ? <DashboardComponent /> : <MenuComponent />}
        </View>
      </View>
    </>
  );
}