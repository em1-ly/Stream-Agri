import React, { useState, useCallback } from 'react'
import { Text, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator, Button, Modal, TextInput } from 'react-native'
import { router, Stack, useFocusEffect } from 'expo-router'
import { ChevronRight, FileSpreadsheet, LogOut } from 'lucide-react-native'
import { useSession } from '@/authContext'
import { forceRunImageUploadService } from '@/utils/imageUploadService'
import { powersync } from '@/powersync/system'
import { setupPowerSync } from '@/powersync/system'
import SyncLogs from './SyncLogs'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { Wifi, WifiOff } from 'lucide-react-native'

const Settings = () => {
  const { signOut } = useSession()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [syncStatus, setSyncStatus] = useState<boolean | null>(null)
  const appVersion = Constants.expoConfig?.version || 'unknown'
  const buildNumber =
    (Constants.expoConfig as any)?.ios?.buildNumber ||
    (Constants.manifest2 as any)?.extra?.eas?.buildNumber ||
    'unknown'
  const buildDate =
    (Constants.manifest2 as any)?.createdAt ||
    (Constants.manifest as any)?.publishedTime ||
    'unknown'

  // Check PowerSync connection status
  useFocusEffect(
    useCallback(() => {
      const checkStatus = () => {
        try {
          const status = powersync.currentStatus
          setSyncStatus(status?.connected ?? false)
        } catch (e) {
          console.warn('Failed to get PowerSync status:', e)
          setSyncStatus(false)
        }
      }
      
      checkStatus()
      const interval = setInterval(checkStatus, 2000) // Check every 2 seconds
      
      return () => clearInterval(interval)
    }, [])
  )

  // Trigger image upload check when settings screen is focused
  useFocusEffect(
    useCallback(() => {
      forceRunImageUploadService().catch(error => 
        console.log('Settings image upload check failed:', error)
      );
      getSavedSignatures()
    }, [])
  );

  // Handle PowerSync reconnection
  const handleReconnectPowerSync = async () => {
    setIsReconnecting(true)
    try {
      // Disconnect first
      await powersync.disconnect()
      console.log('PowerSync disconnected')
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reconnect
      await setupPowerSync()
      console.log('PowerSync reconnection initiated')
      
      // Check status after a delay
      setTimeout(() => {
        const status = powersync.currentStatus
        const isConnected = status?.connected ?? false
        setSyncStatus(isConnected)
        
        if (isConnected) {
          Alert.alert('Success', 'PowerSync reconnected successfully!')
        } else {
          Alert.alert(
            'Connection Issue',
            'PowerSync is still offline. Please check:\n\n1. Internet connection\n2. Server URL is correct\n3. Background App Refresh is enabled\n4. Try logging out and back in'
          )
        }
        setIsReconnecting(false)
      }, 3000)
    } catch (error: any) {
      console.error('Failed to reconnect PowerSync:', error)
      Alert.alert('Error', `Failed to reconnect: ${error.message || 'Unknown error'}`)
      setIsReconnecting(false)
    }
  }

  // Get all saved signatures
  const getSavedSignatures = async () => {
    // const result = await powersync.execute(`SELECT id, mobile_grower_image FROM media_files WHERE mobile_grower_image IS NOT NULL AND model = 'odoo_gms_grower_application'`)
    // // const result = await powersync.execute(`DELETE FROM media_files`)
    // const signatures = result.rows?._array
    // console.log('Signatures:', signatures)
    // return signatures
  }

  // Handle DB Export navigation with password modal
  const handleDbExport = () => {
    setShowPasswordModal(true)
  }

  // Handle password verification
  const handlePasswordSubmit = () => {
    if (password === 'admin123') {
      setShowPasswordModal(false)
      setPassword('')
      router.push('/settings/dbExport' as any)
    } else {
      Alert.alert('Error', 'Incorrect password')
      setPassword('')
    }
  }

  // Close modal
  const closeModal = () => {
    setShowPasswordModal(false)
    setPassword('')
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: "Settings",
        headerShown: false,
        // headerRight: () => (
        //     <View className="flex-row items-center gap-2 mr-4 ">
        //   <TouchableOpacity onPress={() => {
        //     signOut()
        //   }}>
        //     <View className="flex-row items-center gap-2 mr-4 ">
        //       <Text className="text-lg font-bold text-[#65435C]">Logout</Text>
        //       <LogOut size={20} color="#FF0000" />
        //     </View>
        //   </TouchableOpacity>
         
        //   </View>
        // )
      }} />
      <View className="flex-1 p-4 bg-[#65435C]">

      <View className="flex-row items-center justify-end gap-2 mr-4 mb-4">
          <TouchableOpacity onPress={() => {
            signOut()
          }}>
            <View className="flex-row items-center gap-2 mr-4  border border-white rounded-lg p-2">
              <Text className="text-lg font-bold text-white">Logout</Text>
              <LogOut size={20} color="#FF0000" />
            </View>
          </TouchableOpacity>
         
          </View>

        {/* PowerSync Connection Status & Reconnect */}
        <View className="mt-4 p-4 bg-white rounded-xl border-2" style={{ borderColor: syncStatus === true ? '#10b981' : syncStatus === false ? '#ef4444' : '#9ca3af' }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              {syncStatus === true ? (
                <Wifi size={20} color="#10b981" />
              ) : (
                <WifiOff size={20} color="#ef4444" />
              )}
              <Text className="text-lg font-bold text-[#65435C]">
                PowerSync: {syncStatus === true ? 'Connected' : syncStatus === false ? 'Offline' : 'Checking...'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleReconnectPowerSync}
              disabled={isReconnecting}
              className={`px-4 py-2 rounded-lg ${isReconnecting ? 'bg-gray-300' : 'bg-[#65435C]'}`}
            >
              {isReconnecting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-semibold">Reconnect</Text>
              )}
            </TouchableOpacity>
          </View>
          {syncStatus === false && (
            <Text className="text-xs text-red-600 mt-2">
              ⚠️ If PowerSync stays offline after iOS upgrade, try: 1) Enable Background App Refresh in iOS Settings → Tobacco Logistics, 2) Re-login to the app, 3) Check internet connection
            </Text>
          )}
        </View>

        <SyncLogs />

        {/* App version & build info */}
        <View className="mt-4 mb-2 rounded-xl bg-white/10 border border-white/20 p-3">
          <Text className="text-xs text-white opacity-80">
            Version: <Text className="font-semibold">{appVersion}</Text> (build {buildNumber})
          </Text>
          <Text className="text-xs text-white opacity-60 mt-1">
            Updated: {buildDate}
          </Text>
        </View>

        {/* Expo Updates debug info */}
        <View className="mb-2 rounded-xl bg-white/5 border border-white/15 p-3">
          <Text className="text-[10px] text-white opacity-80">
            Runtime: {Updates.runtimeVersion ?? 'n/a'}
          </Text>
          <Text className="text-[10px] text-white opacity-80 mt-1">
            Source: {Updates.isEmbeddedLaunch ? 'embedded' : 'OTA update'}
          </Text>
          <Text className="text-[10px] text-white opacity-80 mt-1">
            Update ID: {Updates.updateId ?? 'embedded'}
          </Text>
          <Text className="text-[10px] text-white opacity-80 mt-1">
            Created:{' '}
            {Updates.createdAt
              ? Updates.createdAt.toISOString()
              : 'n/a'}
          </Text>
        </View>

        <View className="flex-1 justify-end mb-4">
             <TouchableOpacity onPress={handleDbExport} className='bg-white rounded-xl p-2'>
                <View className="flex-row items-center gap-2 mr-4 w-full">
                    <FileSpreadsheet size={20} color="#65435C" />
                    <Text className="text-lg font-bold text-[#65435C]">DB Export</Text>
                </View>
            </TouchableOpacity>
        </View>

      </View>

      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%] max-w-sm">
            <Text className="text-xl font-bold text-[#65435C] mb-2 text-center">
              DB Export Access
            </Text>
            <Text className="text-gray-600 mb-4 text-center">
              Enter admin password to continue
            </Text>
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4 text-base"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoFocus={true}
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 py-3 rounded-lg"
                onPress={closeModal}
              >
                <Text className="text-[#65435C] font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-[#65435C] py-3 rounded-lg"
                onPress={handlePasswordSubmit}
              >
                <Text className="text-white font-semibold text-center">
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

export default Settings
