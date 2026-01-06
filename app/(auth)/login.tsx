"use client"

import React, { useState, useEffect, useCallback } from "react"
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Button, TextInput, ActivityIndicator, Alert, Keyboard } from "react-native"
import {Image} from "expo-image"
import { Eye, EyeOff, Mail, Lock, ArrowRight, Github, Twitter, Settings, Database, Wifi, Phone } from "lucide-react-native"
import { useSession } from "../../authContext"
import { useFocusEffect, useRouter } from "expo-router"
import * as SecureStore from 'expo-secure-store';
import { exportDatabase } from "../../export-db"
// import { useSQLiteContext } from "expo-sqlite"
import { useNetwork } from "@/NetworkContext"
import { powersync, setupPowerSync } from "@/powersync/setup"
import { Connector } from "@/powersync/Connector"

interface LoginScreenProps {
  onRegisterPress: () => void
}

// Define the employee type based on database structure
interface Employee {
  id: number;
  name: string;
  mobile_phone: string;
  mobile_app_password: string;
  [key: string]: any; // For any other properties
}

export default function LoginScreen({ onRegisterPress }: LoginScreenProps) {
  const [email, setEmail] = useState<string>("")
  const [phoneNumber, setPhoneNumber] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [mobileAppPasswordHash, setMobileAppPasswordHash] = useState<string>("")
  const [fullName, setFullName] = useState<string>("")
  const [workPhone, setWorkPhone] = useState<string>("")
  const [userId, setUserId] = useState<number>(0)
  const [syncStatus, setSyncStatus] = useState<string>("")
  const [syncProgress, setSyncProgress] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState("")
  const [needsInitialSync, setNeedsInitialSync] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const { logIn, localLogin, error: authError } = useSession()
  const router = useRouter()
  // const appDatabase = useSQLiteContext()

  const viewUsers = async () => {
    // const users = await appDatabase.getAllAsync('SELECT * FROM users')
    console.log("users")
  }

  const { isConnected } = useNetwork()

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

  useEffect(() => {
    setupPowerSync();
    if (!isConnected) {
      Alert.alert("No internet connection", "Please check your internet connection and try again.")
      return
    }else{
      console.log("Connected to internet")
    }
  }, [isConnected])

  // Check if employees table needs initial sync
  const checkSyncStatus = async () => {
    try {
      // Check if hr_employee table exists and has data
      const employeeCount = await powersync.get('SELECT COUNT(*) as count FROM hr_employee') as { count: number } | null;
      console.log('Employee records available:', employeeCount);
      
      if (!employeeCount || employeeCount.count === 0) {
        console.log('No employee data found - needs initial sync');
        setNeedsInitialSync(true);
        return false;
      }
      
      console.log('Employee data already synced');
      setNeedsInitialSync(false);
      return true;
    } catch (tableError) {
      console.error('Table check error:', tableError);
      console.log('hr_employee table not found - needs initial sync');
      setNeedsInitialSync(true);
      return false;
    }
  }

  // Perform initial sync after user authentication
  const performInitialSync = async () => {
    console.log('Starting initial sync...');
    setIsSyncing(true);
    setSyncStatusText("Connecting to PowerSync...");
    setDownloadProgress(5);

    const connector = new Connector();
    let maxProgress = 5; // Track maximum progress to prevent going backwards
    
    const unregister = powersync.registerListener({
      statusChanged: (status) => {
        console.log('🔄 PowerSync status during initial sync:', status);
        
        // Update progress bar - downloadProgress is nested in dataFlow
        const statusAny = status as any; // Cast to bypass TypeScript restrictions
        
        let newProgress = maxProgress; // Start with current max
        
        if (status.connected) {
          if (statusAny.dataFlow?.downloading && statusAny.dataFlow?.downloadProgress) {
            // Extract progress from nested object
            const progressObj = statusAny.dataFlow.downloadProgress;
            console.log('Download progress object:', progressObj);
            
            // Handle different progress object structures
            let progressValue = 0;
            if (typeof progressObj === 'number') {
              progressValue = progressObj;
            } else if (progressObj && typeof progressObj === 'object') {
              // Try different possible property names
              progressValue = progressObj.progress || progressObj.value || progressObj.percentage || 0;
              if (progressValue > 1) progressValue = progressValue / 100; // Convert if percentage
            }
            
            // Map download progress to 20-90% range (reserve 5-20% for connection, 90-100% for completion)
            newProgress = Math.max(maxProgress, 20 + (progressValue * 70));
            setSyncStatusText(`Downloading data... ${Math.round(progressValue * 100)}%`);
            console.log(`📊 Progress: ${Math.round(newProgress)}%`);
            
          } else if (status.connected && !status.lastSyncedAt) {
            // Connected but not synced yet - gradually increase from 10% to 20%
            newProgress = Math.max(maxProgress, 15);
            setSyncStatusText("Connected, preparing to sync...");
          } else if (status.connected) {
            // Connected and syncing but no download progress yet
            newProgress = Math.max(maxProgress, 20);
            setSyncStatusText("Connected, syncing...");
          }
        } else {
          // Not connected - keep at 5% but don't reset if we've made progress
          newProgress = Math.max(maxProgress, 5);
          setSyncStatusText("Connecting to PowerSync...");
        }
        
        // Only update if progress increased
        if (newProgress > maxProgress) {
          maxProgress = newProgress;
          setDownloadProgress(newProgress);
        }
        
        // Sync complete when connected and has synced data
        if (status.connected && status.lastSyncedAt) {
          console.log('✅ PowerSync connected and synced - sync complete');
          setSyncStatusText("Sync complete! Redirecting...");
          setDownloadProgress(100);
          maxProgress = 100;
          
          setTimeout(() => {
            setIsSyncing(false);
            setNeedsInitialSync(false);
            unregister();
            router.replace("/(app)/(tabs)");
          }, 1000);
        }
      }
    });
    
    try {
      await powersync.connect(connector);
      console.log('PowerSync connection initiated');
      
      // Also check if already connected (in case connection was instant)
      setTimeout(() => {
        const status = powersync.currentStatus;
        if (status?.connected && status?.lastSyncedAt) {
          console.log('💡 Already connected and synced - sync complete');
          setSyncStatusText("Already synced! Redirecting...");
          setDownloadProgress(100);
          setTimeout(() => {
            setIsSyncing(false);
            setNeedsInitialSync(false);
            unregister();
            router.replace("/(app)/(tabs)");
          }, 1000);
        }
      }, 2000);
    } catch (error) {
      console.error('Error connecting to PowerSync:', error);
      setLoginError('Failed to sync data. Please try again.');
      setIsSyncing(false);
      setSyncStatusText("");
      setDownloadProgress(0);
      unregister();
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect Login Screen');
      powersync.registerListener({
        statusChanged: (status) => {
          setSyncStatus(JSON.stringify(status));
          console.log('PowerSync status on Login Screen:', status);
          
          if (status.connected) {
            setSyncProgress('Ready to login');
          } else {
            setSyncProgress('Connecting...');
          }
        }
      });
    }, [])
  );



  


  const handleLogin = async () => {
    console.log('🔥 ============ LOGIN PRESSED ============')
    console.log('📱 Raw phoneNumber:', `"${phoneNumber}"`)
    console.log('🔒 Raw password length:', password?.length)
    console.log('📏 phoneNumber length:', phoneNumber?.length)
    console.log('🧹 phoneNumber after trim:', `"${phoneNumber?.trim()}"`)
    console.log('🧹 password after trim length:', password?.trim()?.length)
    
    // Trim whitespace and validate
    const trimmedPhoneNumber = phoneNumber?.trim() || '';
    const trimmedPassword = password?.trim() || '';
    
    console.log('✅ Final trimmedPhoneNumber:', `"${trimmedPhoneNumber}"`)
    console.log('✅ Final trimmedPassword length:', trimmedPassword.length)

    if (!trimmedPhoneNumber || !trimmedPassword) {
      console.log('❌ VALIDATION FAILED - missing phone or password')
      console.log('❌ trimmedPhoneNumber is empty:', !trimmedPhoneNumber)
      console.log('❌ trimmedPassword is empty:', !trimmedPassword)
      setLoginError("Please enter both phone number and password")
      return
    }
    
    console.log('✅ VALIDATION PASSED - proceeding with login')
    console.log('🚀 ============ STARTING LOGIN PROCESS ============')
    
    setIsLoggingIn(true)
    setLoginError(null)
    
    try {
      // Step 1: Check if employees table has synced data
      const hasSyncedData = await checkSyncStatus();
      
      if (hasSyncedData && !needsInitialSync) {
        console.log('📊 Employee data already synced - proceeding with local authentication');
        
        // If data is synced, do local authentication (online or offline)
        try {
          // Query local PowerSync database for user
          const currentUser = await powersync.get<Employee>('SELECT * from hr_employee WHERE mobile_phone = ?', [trimmedPhoneNumber]);
          console.log('currentUser from powersync:', currentUser)
          
          if (!currentUser) {
            setLoginError("User not found. Please check your phone number.");
            setIsLoggingIn(false);
            return;
          }
          
          console.log('User found, authenticating locally...')
          
          // Authenticate based on connection status
          let success = false;
          if (isConnected) {
            console.log('Authenticating online...');
            success = await logIn(trimmedPassword, trimmedPhoneNumber, currentUser.mobile_app_password, currentUser.mobile_app_password_salt);
          } else {
            console.log('Authenticating offline...');
            success = await localLogin(trimmedPassword, currentUser.mobile_app_password, currentUser.mobile_app_password_salt, currentUser.name, currentUser.mobile_phone, String(currentUser.id));
          }
          
          if (success) {
            console.log('✅ Login successful - navigating to home');
            setIsLoggingIn(false);
            router.replace("/(app)/(tabs)");
          } else {
            setLoginError(authError || "Login failed. Please check your credentials.");
            setIsLoggingIn(false);
          }
          
        } catch (error: any) {
          console.error('PowerSync query error:', error);
          setLoginError(`Error retrieving user data: ${error.message || 'Unknown error'}`);
          setIsLoggingIn(false);
        }
        
      } else {
        console.log('📋 No employee data or needs sync - authenticate via server first');
        
        // If no sync data, authenticate user using online API first
        if (!isConnected) {
          setLoginError("Internet connection required for initial setup. Please connect and try again.");
          setIsLoggingIn(false);
          return;
        }
        
        console.log('🔐 Authenticating user via server...');
        
        try {
          // Authenticate directly with server (simplified approach)
          const loginSuccess = await logIn(trimmedPassword, trimmedPhoneNumber, '', '');
          
          if (!loginSuccess) {
            setLoginError(authError || "Login failed. Please check your credentials.");
            setIsLoggingIn(false);
            return;
          }
          
          console.log('✅ User authenticated via server - starting sync...');
          setIsLoggingIn(false);
          
          // Start sync process after successful authentication
          await performInitialSync();
          
        } catch (authError) {
          console.error('Server authentication error:', authError);
          setLoginError("Authentication failed. Please check your credentials.");
          setIsLoggingIn(false);
          return;
        }
      }
      
    } catch (error: any) {
      console.error('Login process error:', error);
      setLoginError("An error occurred during login. Please try again.");
      setIsLoggingIn(false);
    }
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
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-gray-500">Welcome Back</Text>
            <View className="mb-6 ml-1">
              {isConnected ? (
                <Wifi size={20} color="#1AD3BB"  />
              ) : (
                <Wifi size={20} color="red"  />
              )}
            </View>
          </View>
          <Text className="text-[#1AD3BB] dark:text-gray-400 text-center mt-2">Sign in to your account to continue</Text>
          
          {loginError && (
            <View className="mt-2 mb-2 p-2 bg-red-100 rounded-md w-full">
              <Text className="text-red-600 text-center">{loginError}</Text>
            </View>
          )}

          {/* Sync Progress Bar */}
          {isSyncing && (
            <View className="mt-2 mb-4 w-full">
              <Text className="text-sm text-[#65435C] mb-2 text-center">{syncStatusText}</Text>
              <View className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-[#1AD3BB] rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1 text-center">
                {Math.round(downloadProgress)}% complete
              </Text>
            </View>
          )}
        </View>

        
          <>
            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Phone size={20} color="#1AD3BB" />
              <TextInput 
                value={phoneNumber} 
                onChangeText={setPhoneNumber} 
                keyboardType="phone-pad" 
                placeholder="Enter Phone Number"
                placeholderTextColor="#9CA3AF"
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
                autoCapitalize="none"
              />
            </View>

            <View className="flex-row items-center rounded-md m-3 border-2 border-[#65435C] px-2">
              <Lock size={20} color="#1AD3BB" />
              <TextInput 
                value={password} 
                onChangeText={setPassword}  
                placeholder="Password" 
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                className="flex-1 p-3.5"
                style={{ color: '#111827' }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color="#4B5563" />
                ) : (
                  <Eye size={20} color="#4B5563" />
                )}
              </TouchableOpacity>
            </View>

            <View>
              <TouchableOpacity 
                className={`rounded-md m-3 ${
                  isLoggingIn || isSyncing 
                    ? 'bg-gray-400' 
                    : 'bg-[#65435C]'
                }`}
                onPress={handleLogin}
                disabled={isLoggingIn || isSyncing}
              >
                {isLoggingIn ? (
                  <ActivityIndicator color="white" className="p-2" />
                ) : isSyncing ? (
                  <Text className="text-white text-xl text-center p-2">Syncing...</Text>
                ) : (
                  <Text className="text-white text-xl text-center p-2">Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        
        <TouchableOpacity 
          className="mt-4 rounded-md border-2 border-[#65435C] p-2" 
          onPress={() => router.push('/(auth)/adminLogin')}
        >
          <Text className="text-[#1AD3BB] text-center">
            Server Configuration
          </Text>
        </TouchableOpacity>

        {/* <TouchableOpacity 
          className="mt-4" 
          onPress={viewUsers}
        >
          <Text className="text-[#1AD3BB] text-center">
            View Users
          </Text>
        </TouchableOpacity> */}
        
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
