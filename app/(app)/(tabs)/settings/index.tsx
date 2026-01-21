import React, { useState, useCallback } from 'react'
import { Text, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator, Button, Modal, TextInput } from 'react-native'
import { router, Stack, useFocusEffect } from 'expo-router'
import { ChevronRight, FileSpreadsheet, LogOut } from 'lucide-react-native'
import { useSession } from '@/authContext'
import { forceRunImageUploadService } from '@/utils/imageUploadService'
import { powersync } from '@/powersync/system'
import SyncLogs from './SyncLogs'
import Constants from 'expo-constants'

const Settings = () => {
  const { signOut } = useSession()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const appVersion = Constants.expoConfig?.version || 'unknown'
  const buildNumber =
    (Constants.expoConfig as any)?.ios?.buildNumber ||
    (Constants.manifest2 as any)?.extra?.eas?.buildNumber ||
    'unknown'
  const buildDate =
    (Constants.manifest2 as any)?.createdAt ||
    (Constants.manifest as any)?.publishedTime ||
    'unknown'

  // Trigger image upload check when settings screen is focused
  useFocusEffect(
    useCallback(() => {
      forceRunImageUploadService().catch(error => 
        console.log('Settings image upload check failed:', error)
      );
      getSavedSignatures()
    }, [])
  );

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
