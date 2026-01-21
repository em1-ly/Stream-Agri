"use client"

import React, { useState, useEffect, useCallback } from "react"
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Button, TextInput, ActivityIndicator, Alert, Keyboard } from "react-native"
import {Image} from "expo-image"
import { Eye, EyeOff, Mail, Lock, Settings, Database } from "lucide-react-native"
import { useSession } from "@/authContext"
import { useFocusEffect, useRouter } from "expo-router"
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import axios from "axios";
import { powersync } from "@/powersync/system";


interface LoginScreenProps {
  onRegisterPress: () => void
}

interface Employee {
  id: number;
  name: string;
  work_phone: string;
  mobile_app_password: string;
}

export default function LoginScreen({ onRegisterPress }: LoginScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [serverIP, setServerIP] = useState("")
  const [database, setDatabase] = useState("odoo_db2")
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [powerSyncURI, setPowerSyncURI] = useState("")

  const { adminLogin, session, error: authError } = useSession()
  const router = useRouter()


  // Load saved server IP and database on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedIP = await SecureStore.getItemAsync('odoo_server_ip');
        if (savedIP) {
          setServerIP(savedIP);
        }
        
        const savedDB = await SecureStore.getItemAsync('odoo_database');
        if (savedDB) {
          setDatabase(savedDB);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  const [syncStatus, setSyncStatus] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect Admin Login Screen');
      powersync.registerListener({
        statusChanged: (status) => {
          setSyncStatus(status.connected);
          console.log('PowerSync status Admin Login Screen:', status);
        }
      });
    }, [])
  );
  

  const handleAdminLogin = async () => {
    console.log('Admin Login Pressed')

    if (!adminUsername || !adminPassword) {
      setLoginError("Please enter both admin username and password")
      return
    }
    
    // Save server configuration
    await SecureStore.setItemAsync('odoo_server_ip', serverIP);
    await SecureStore.setItemAsync('odoo_database', database);
    
    setIsLoggingIn(true)
    setLoginError(null)
    
    try {
      const success = await adminLogin(adminUsername, adminPassword, powerSyncURI)
      if (success) {
        console.log('Admin Login Success - navigating to user login')
        router.replace('/login');
      } else {
        console.log('Admin Login Failed')
        console.log(authError)
        setLoginError(authError || "Login failed. Please check your credentials.")
      }
    } catch (err) {
      setLoginError("An error occurred during login")
      console.error(err)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleClearDataAndResync = async () => {
    Alert.alert(
      'Clear Data & Resyncie',
      'This will clear ALL local data including server configuration, sessions, and database. You will need to reconfigure the server on next login. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Resync',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingIn(true);
              setLoginError(null);
              
              // Disconnect PowerSync
              await powersync.disconnect();
              
              // Clear ALL SecureStore data - comprehensive list
              const secureStoreKeys = [
                'session',
                'odoo_employee_id',
                'odoo_employee_name',
                'odoo_custom_session_id',
                'employee_jwt',
                'odoo_server_ip',           // Server configuration
                'odoo_database',            // Database name
                'power_sync_uri',           // PowerSync URI
                'odoo_admin_session_id',    // Admin session
                'odoo_session_id',          // Session ID
                'powersync_private_key',    // PowerSync keys
                'powersync_jwk',            // PowerSync JWK
                'powersync_public_key',     // PowerSync public key
              ];
              
              // Delete all SecureStore items
              for (const key of secureStoreKeys) {
                try {
                  await SecureStore.deleteItemAsync(key);
                } catch (error) {
                  // Ignore errors for keys that don't exist
                  console.log(`Key ${key} not found or already deleted`);
                }
              }
              
              // Clear local state
              setServerIP('');
              setDatabase('odoo_db2');
              setAdminUsername('');
              setAdminPassword('');
              setPowerSyncURI('');
              
              // Clear PowerSync database - delete all synced data
              try {
                // Get all table names and clear them (except system tables)
                const tables = await powersync.getAll<{ name: string }>(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'ps_%'"
                );
                
                for (const table of tables || []) {
                  try {
                    await powersync.execute(`DELETE FROM ${table.name}`);
                  } catch (error) {
                    console.log(`Could not clear table ${table.name}:`, error);
                  }
                }
              } catch (error) {
                console.error('Error clearing PowerSync database:', error);
              }
              
              Alert.alert(
                'Success',
                'All data cleared successfully. Please reconfigure server settings on next login.',
                [{ text: 'OK' }]
              );
              
              setIsLoggingIn(false);
            } catch (error: any) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', `Failed to clear data: ${error.message || 'Unknown error'}`);
              setIsLoggingIn(false);
            }
          }
        }
      ]
    );
  }

  const handleClearCache = async () => {
    Alert.alert(
      'Clear App Cache',
      'This will clear all cached images and temporary files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingIn(true);
              setLoginError(null);
              
              let clearedItems = 0;
              
              // Clear FileSystem cache directory (includes expo-image cache)
              try {
                const cacheDir = FileSystem.cacheDirectory;
                if (cacheDir) {
                  const files = await FileSystem.readDirectoryAsync(cacheDir);
                  for (const file of files) {
                    try {
                      await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
                      clearedItems++;
                    } catch (error) {
                      console.error(`Error deleting cache file ${file}:`, error);
                    }
                  }
                  console.log(`FileSystem cache cleared: ${clearedItems} items`);
                }
              } catch (error) {
                console.error('Error clearing FileSystem cache:', error);
              }
              
              // Clear document directory temporary files
              try {
                const docDir = FileSystem.documentDirectory;
                if (docDir) {
                  // Only clear temp files, not user data
                  const files = await FileSystem.readDirectoryAsync(docDir);
                  for (const file of files) {
                    // Skip important files like databases
                    if (!file.includes('.db') && !file.includes('SQLite')) {
                      try {
                        await FileSystem.deleteAsync(`${docDir}${file}`, { idempotent: true });
                        clearedItems++;
                      } catch (error) {
                        // Ignore errors for protected files
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('Error clearing document directory temp files:', error);
              }
              
              Alert.alert(
                'Success',
                `App cache cleared successfully. ${clearedItems} items removed.`,
                [{ text: 'OK' }]
              );
              
              setIsLoggingIn(false);
            } catch (error: any) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', `Failed to clear cache: ${error.message || 'Unknown error'}`);
              setIsLoggingIn(false);
            }
          }
        }
      ]
    );
  }



  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24 }}
        contentContainerStyle={isKeyboardVisible ? {
          paddingVertical: 40,
          paddingBottom: 400
        } : {
          flexGrow: 1,
          justifyContent: 'center',
          paddingVertical: 20
        }}
        scrollEnabled={isKeyboardVisible}
        showsVerticalScrollIndicator={isKeyboardVisible}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10 mt-10">
          <View>
            <Image 
              source={require('../../assets/images/odoo_logo.svg')}
              style={{ width: 120, height: 120 }}
              contentFit="contain"
            />
          </View>
          <Text className="text-2xl font-bold text-gray-500 dark:text-white">Welcome</Text>
          <Text className="text-[#1AD3BB] dark:text-gray-400 text-center mt-2">Sign in to your account and prime the database</Text>
          
          {loginError && (
            <View className="mt-2 mb-2 p-2 bg-red-100 rounded-md w-full">
              <Text className="text-red-600 text-center">{loginError}</Text>
            </View>
          )}
        </View>

          <View className="mb-5">
            <Text className="font-bold text-[#65435C] text-lg mb-2">Server Configuration</Text>
            
            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Settings size={20} color="#1AD3BB" />
              <TextInput 
                value={serverIP} 
                onChangeText={setServerIP} 
                placeholder="Enter Server IP (e.g. 192.168.1.100:8069)"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
                autoCapitalize="none"
              />
            </View>
            
            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Database size={20} color="#1AD3BB" />
              <TextInput 
                value={database} 
                onChangeText={setDatabase} 
                placeholder="Enter Database Name"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
                autoCapitalize="none"
              />
            </View>

            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Mail size={20} color="#1AD3BB" />
              <TextInput
                value={adminUsername} 
                onChangeText={setAdminUsername} 
                placeholder="Enter Admin Username"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
                autoCapitalize="none"
              />
            </View>
            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Lock size={20} color="#1AD3BB" />
              <TextInput 
                value={adminPassword} 
                onChangeText={setAdminPassword} 
                placeholder="Enter Admin Password"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5 text-gray-900"
                style={{ color: '#111827' }}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
              />
               <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color="#4B5563" />
                ) : (
                  <Eye size={20} color="#4B5563" />
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              {/* <Mail size={20} color="#1AD3BB" /> */}
              <TextInput
                value={powerSyncURI} 
                onChangeText={setPowerSyncURI} 
                placeholder="PowerSync URI"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
                autoCapitalize="none"
              />
            </View>

            
            <View className="flex-row justify-between">
              <TouchableOpacity 
                className="bg-[#1AD3BB] rounded-md p-2 flex-1 mr-2"
                onPress={() => router.push('/(auth)/login')}
              >
                <Text className="text-white text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`rounded-md p-2 flex-1 ml-2 ${
                  isLoggingIn 
                    ? 'bg-gray-400' 
                    : 'bg-[#65435C]'
                }`}
                onPress={handleAdminLogin}
                disabled={isLoggingIn}
              >
                <Text className="text-white text-center">
                  {isLoggingIn ? 'Logging in...' : 'Login & Configure'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        
          <TouchableOpacity 
            className="mt-4 rounded-md border-2 border-red-500 p-2" 
            onPress={handleClearDataAndResync}
            disabled={isLoggingIn}
          >
            <Text className="text-red-500 text-center">
              Clear Data & Resyncie
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="mt-4 rounded-md border-2 border-orange-500 p-2" 
            onPress={handleClearCache}
            disabled={isLoggingIn}
          >
            <Text className="text-orange-500 text-center">
              Clear App Cache
            </Text>
          </TouchableOpacity>
        
        {/* <TouchableOpacity 
          className="mt-4 rounded-md border-2 border-[#65435C] p-2" 
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-[#1AD3BB] text-center">
            Field Officer Login
          </Text>
        </TouchableOpacity> */}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
