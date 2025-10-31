import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView } from 'react-native'
import React, { useCallback, useState, useEffect } from 'react'
import { CircleUserRound, FolderSync, Wifi, Users, Settings, BarChart, Leaf, ChevronRight, Building, UserCheck, FileCheck, UserX, User } from 'lucide-react-native';

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
  const [growerStats, setGrowerStats] = useState({
    total: 0,
    approved: 0,
    contracted: 0,
    rejected: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  console.log(session)

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
    getServerIP();
    fetchGrowerStats();
    fetchCompanyInfo();
  }, []);
  
  // Update pending uploads count
  const updatePendingCount = async () => {
    try {
      const count = await getUploadPendingCount();
      setPendingUploads(count);
    } catch (error) {
      console.error('Error getting pending uploads count:', error);
      setPendingUploads(0);
    }
  };

  const fetchCompanyInfo = async () => {
    const companyInfo = await powersync.execute(`SELECT * FROM res_company`);
    console.log('Company info:', companyInfo);
    setCompanyInfo(companyInfo.rows?._array?.[0] || null);
  };

  // Fetch grower statistics filtered by current employee
  const fetchGrowerStats = async () => {
    // TODO: Put this in its own component
    try {
      setLoadingStats(true);
      
      // Get current employee ID
      const employeeId = await SecureStore.getItemAsync('odoo_employee_id');
      const currentEmployeeId = employeeId || '148'; // fallback to default
      
      console.log('Fetching grower stats for employee:', currentEmployeeId);
      
      // Get user's accessible regions from HR management
      const userRegions = await powersync.execute(`
        SELECT DISTINCT region_id 
        FROM odoo_gms_hr_management 
        WHERE employee = ?
      `, [currentEmployeeId]);
      
      const userRegionIds = userRegions.rows?._array?.map((row: any) => row.region_id) || [];
      
      if (userRegionIds.length === 0) {
        console.log('No regions found for employee, using all regions');
        // If no regions found, use all regions
        const allRegions = await powersync.execute(`SELECT id FROM odoo_gms_region`);
        userRegionIds.push(...(allRegions.rows?._array?.map((row: any) => row.id) || []));
      }
      
      const placeholders = userRegionIds.map(() => '?').join(',');
      
      // 1. Total growers in user's regions (through grower applications)
      const totalGrowers = await powersync.execute(`
        SELECT COUNT(DISTINCT grower_id) as count 
        FROM odoo_gms_grower_application 
        WHERE region_id IN (${placeholders})
      `, userRegionIds);
      
      // 2. Approved growers (from grower applications)
      const approvedGrowers = await powersync.execute(`
        SELECT COUNT(*) as count 
        FROM odoo_gms_grower_application 
        WHERE state = 'approved' AND field_technician_id = ?
      `, [currentEmployeeId]);
      
      // 3. Contracted growers (from production cycle registration)
      const contractedGrowers = await powersync.execute(`
        SELECT COUNT(DISTINCT grower_id) as count 
        FROM odoo_gms_production_cycle_registration 
        WHERE field_technician_id = ?
      `, [currentEmployeeId]);
      
      // 4. Rejected growers (from grower applications)
      const rejectedGrowers = await powersync.execute(`
        SELECT COUNT(*) as count 
        FROM odoo_gms_grower_application 
        WHERE state = 'rejected' AND field_technician_id = ?
      `, [currentEmployeeId]);
      
      setGrowerStats({
        total: totalGrowers.rows?._array?.[0]?.count || 0,
        approved: approvedGrowers.rows?._array?.[0]?.count || 0,
        contracted: contractedGrowers.rows?._array?.[0]?.count || 0,
        rejected: rejectedGrowers.rows?._array?.[0]?.count || 0
      });
      
      console.log('Grower stats updated:', {
        total: totalGrowers.rows?._array?.[0]?.count || 0,
        approved: approvedGrowers.rows?._array?.[0]?.count || 0,
        contracted: contractedGrowers.rows?._array?.[0]?.count || 0,
        rejected: rejectedGrowers.rows?._array?.[0]?.count || 0
      });
      
    } catch (error) {
      console.error('Error fetching grower stats:', error);
      // Set default values on error
      setGrowerStats({
        total: 0,
        approved: 0,
        contracted: 0,
        rejected: 0
      });
    } finally {
      setLoadingStats(false);
    }
  };
  
  // Trigger image upload check when main screen is focused
  useFocusEffect(
    useCallback(() => {
      // Update pending count when screen comes into focus
      updatePendingCount();
      // Refresh grower stats when screen comes into focus
      fetchGrowerStats();
      
      if (isConnected) {
        forceRunImageUploadService().catch(error => 
          console.log('Main screen image upload check failed:', error)
        );
      }
    }, [isConnected])
  );
  
  // Calculate dynamic tile sizes based on screen width
  const screenWidth = Dimensions.get('window').width;
  const tileSize = (screenWidth - 48) / 2; // 48 = 24px padding on each side + 8px gap between tiles
  
  return (
    <>
    <Stack.Screen options={{ 
      headerTitle: () => null,
      headerShown: true,
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/(app)/settings' as any)}>
          <View className='flex flex-row items-center gap-2 mr-4'>
            {pendingUploads > 0 && (
              <View className="px-2 py-1 rounded-full bg-yellow-500">
                <Text className="text-white text-xs font-medium">
                  {pendingUploads}
                </Text>
              </View>
            )}
            {isConnected ? (
              <>
                <Wifi size={20} color="#1AD3BB" />
                <FolderSync size={20} color="#65435C" />
              </>
            ) : (
              <Wifi size={20} color="#FF0000" />
            )}
          </View>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.push('/(app)/settings' as any)}>
          <View className='flex flex-row items-center gap-2 ml-4'>
            <Building size={25} color="#1AD3BB" />
            {/* <Text className="ml-1 text-[#65435C] font-semibold">{session?.name}</Text> */}
            <Text className="text-md ml-1 text-[#65435C] font-semibold capitalize w-[80%]">{companyInfo?.name}</Text>
          </View>
        </TouchableOpacity>
      ),
      
      
    }} />
    <ScrollView>
    <View className='flex-1 p-4 bg-[#65435C]'>
      {/* Welcome Card */}
      <View className='bg-white rounded-2xl p-4 mb-4 mt-4 shadow-sm'>
        <Text className='text-2xl font-semibold text-[#65435C]'>Welcome back,</Text>
        <Text className='text-lg font-bold text-[#1AD3BB]'>{session?.name}</Text>
        <Text className='text-gray-500 mt-1'>What would you like to do today?</Text>
      </View>
      
      {/* Tiles Grid */}
      <View className='flex-row flex-wrap justify-between'>
        {/* Growers Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          onPress={() => router.push('/(app)/receiving' as any)}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Users size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Receiving</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Manage profiles</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Inputs Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          onPress={() => router.push('/(app)/inputs' as any)}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Leaf size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Inventory</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Track resources</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* M&E Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          onPress={() => router.push('/(app)/datacapturing' as any)}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <BarChart size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Data Capturing</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>Scan and enter bale data</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Settings Tile */}
        <TouchableOpacity 
          style={{ width: tileSize, height: tileSize }}
          className='bg-white rounded-2xl p-4 mb-4 shadow-sm'
          onPress={() => router.push('/(app)/settings' as any)}
        >
          <View className='flex-1 justify-between'>
            <View className='h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center'>
              <Settings size={24} color="#1AD3BB" />
            </View>
            <View>
              <Text className='text-lg font-semibold text-[#65435C]'>Settings</Text>
              <View className='flex-row items-center mt-1'>
                <Text className='text-gray-500 text-sm'>App preferences</Text>
                <ChevronRight size={16} color="#65435C" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      {/* Grower Statistics Card */}
      
    </View>
    </ScrollView>
    </>
  )
}

export default index