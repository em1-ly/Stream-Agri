import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView, InteractionManager } from 'react-native'
import React, { useCallback, useState, useEffect, useRef } from 'react'
import { CircleUserRound, FolderSync, Wifi, Package, Truck, Settings, Wrench, ClipboardList, ChevronRight, Building, UserCheck, FileCheck, UserX, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/authContext';
import { exportDatabase } from '@/export-db';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useNetwork } from '@/NetworkContext';
import { forceRunImageUploadService, getUploadPendingCount } from '@/utils/imageUploadService';
import * as SecureStore from 'expo-secure-store';
import { powersync } from '@/powersync/system';
import { ResCompanyRecord } from '@/powersync/Schema';


const index = () => {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const { isConnected } = useNetwork()
  const [pendingUploads, setPendingUploads] = useState(0);
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<ResCompanyRecord | null>(null);
  const navigationInProgress = useRef(false);

  // Fetch server IP and grower stats on component mount
  useEffect(() => {
    const getServerIP = async () => {
      try {
        const ip = await SecureStore.getItemAsync('odoo_server_ip');
        setServerIP(ip);
      } catch (error) {
        console.error('Error fetching server IP:', error);
      }
    };
 
    fetchCompanyInfo();
  }, []);
  


  const fetchCompanyInfo = async () => {
    const companyInfo = await powersync.execute(`SELECT * FROM res_company`);
    console.log('Company info:', companyInfo);
    setCompanyInfo(companyInfo.rows?._array?.[0] || null);
  };


  
  // Calculate dynamic tile sizes based on screen width
  const screenWidth = Dimensions.get('window').width;
  const tileSize = (screenWidth - 48) / 2; // 48 = 24px padding on each side + 8px gap between tiles

  // Optimized navigation handler with immediate feedback for lower-end devices
  const handleNavigation = useCallback((route: string) => {
    // Prevent double-taps on slower devices
    if (navigationInProgress.current) return;
    navigationInProgress.current = true;
    
    // Navigate immediately (most important for perceived performance)
    router.push(route as any);
    
    // Haptic feedback after navigation (non-blocking)
    // Use setTimeout to avoid blocking navigation on slower devices
    setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Silently fail on devices that don't support haptics
        });
      } catch (e) {
        // Ignore haptic errors
      }
      // Reset navigation lock after a short delay
      setTimeout(() => {
        navigationInProgress.current = false;
      }, 300);
    }, 0);
  }, [router]);
  
  return (
    <>
    <ScrollView 
      className='flex-1 bg-[#65435C]'
      contentContainerStyle={{ paddingBottom: 20 }}
    >
    <View className='flex-1 p-4'>
  
      {/* Tiles Grid */}
      <View className='flex-row flex-wrap justify-between'>
        {/* Growers Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          activeOpacity={0.7}
          onPress={() => handleNavigation('/(app)/inventory/receive')}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Package size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Receive</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Receive bales</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Inputs Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          activeOpacity={0.7}
          onPress={() => handleNavigation('/(app)/inventory/dispatch')}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Truck size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Dispatch</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Warehouse dispatch</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* M&E Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          activeOpacity={0.7}
          onPress={() => handleNavigation('/(app)/inventory/operations')}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Wrench size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Operations</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Warehouse operations</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Floor Dispatch Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          activeOpacity={0.7}
          onPress={() => handleNavigation('/(app)/inventory/manual-entries')}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <ClipboardList size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Manual Entries</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Manual entries</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Settings Tile */}
        
      </View>
      {/* Grower Statistics Card */}

      
      
    </View>
    </ScrollView>
    </>
  )
}

export default index