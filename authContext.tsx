import { useContext, createContext, type PropsWithChildren, ReactNode, useState, useEffect } from 'react';
import { useStorageState } from './useStorageState';
import axios from 'axios';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
// import bcrypt from 'bcryptjs';
import 'react-native-get-random-values';
// import bcrypt from 'react-native-bcrypt';
import * as Crypto from 'expo-crypto';
import { startImageUploadService, stopImageUploadService } from '@/utils/imageUploadService';
import { startGrowerApplicationImageUploadService, stopGrowerApplicationImageUploadService } from '@/utils/growerApplicationImageUploadService';

// Define a type for the Odoo user data
interface OdooUserData {
  uid: number;
  name: string;
  username: string;
  partner_id: number;
  is_admin: boolean;
  session_id?: string;
}

// Default values for Odoo connection
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_ODOO_SERVER_IP || '';
const DEFAULT_DB = process.env.EXPO_PUBLIC_ODOO_DATABASE || '';

const AuthContext = createContext<{
  logIn: (password: string, phoneNumber: string, mobileAppPasswordHash: string, mobile_app_password_salt: string) => Promise<boolean>;
  localLogin: (password: string, mobileAppPasswordHash: string, mobile_app_password_salt: string, fullName: string, workPhone: string, userId: string) => Promise<boolean>;
  adminLogin: (login: string, password: string, powerSyncURI: string) => Promise<boolean>;
  signOut: () => void;
  session?: OdooUserData | null;
  isLoading: boolean;
  error: string | null;
}>({
  logIn: async () => false,
  localLogin: async () => false,
  adminLogin: async () => false,
  signOut: () => null,
  session: null,
  isLoading: false,
  error: null,
});

// This hook can be used to access the user info.
export function useSession() {
  const value = useContext(AuthContext);
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('useSession must be wrapped in a <SessionProvider />');
    }
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren): ReactNode {
  const [[isLoading, session], setSession] = useStorageState('session');
  const [error, setError] = useState<string | null>(null);

  // Store the session ID in secure storage
  const storeSessionId = async (sessionId: string) => {
    await SecureStore.setItemAsync('odoo_session_id', sessionId);
  };

  // Get session ID from secure storage
  const getSessionId = async () => {
    return await SecureStore.getItemAsync('odoo_session_id');
  };

  // Get the server URL from secure storage
  const getServerUrl = async (): Promise<string> => {
    try {
      const serverIp = await SecureStore.getItemAsync('odoo_server_ip');
      if (serverIp && serverIp.trim()) {
        const trimmedUrl = serverIp.trim();
        // If it doesn't start with http or https, add https
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          return `https://${trimmedUrl}`;
        }
        return trimmedUrl;
      }
    } catch (error) {
      console.error('Error getting server URL:', error);
    }
    return DEFAULT_API_URL || 'https://commercial.ctl.odoo.ws';
  };

  // Get the database name from secure storage
  const getDatabase = async (): Promise<string> => {
    try {
      const db = await SecureStore.getItemAsync('odoo_database');
      if (db) {
        return db;
      }
    } catch (error) {
      console.error('Error getting database name:', error);
    }
    return DEFAULT_DB || 'commercial_ctl_odoo_ws';
  };

  // Start/stop image upload service based on authentication status
  useEffect(() => {
    const parsedSession = session ? JSON.parse(session) : null;
    
    if (parsedSession && !isLoading) {
      // User is authenticated, start the image upload services
      console.log('🚀 User authenticated, starting image upload services');
      startImageUploadService();
      startGrowerApplicationImageUploadService();
    } else {
      // User is not authenticated, stop the services
      console.log('⏹️ User not authenticated, stopping image upload services');
      stopImageUploadService();
      stopGrowerApplicationImageUploadService();
    }

    // Cleanup function to stop services when component unmounts
    return () => {
      stopImageUploadService();
      stopGrowerApplicationImageUploadService();
    };
  }, [session, isLoading]);

  return (
    <AuthContext.Provider
      value={{
        logIn: async (password: string, phoneNumber: string, mobileAppPasswordHash: string, mobile_app_password_salt: string) => {
          setError(null);
          console.log('Login Function')
          console.log(password, phoneNumber, mobileAppPasswordHash, mobile_app_password_salt)
          // const passwordWithSalt = password + mobile_app_password_salt;

          // const calculatedHash = await Crypto.digestStringAsync(
          //   Crypto.CryptoDigestAlgorithm.SHA256,
          //   passwordWithSalt
          // );

          // const isMatch = calculatedHash === mobileAppPasswordHash;
          // console.log('isMatch', isMatch)

          
          // const isMatch = bcrypt.compareSync(password, mobileAppPasswordHash);
          // console.log('isMatch', isMatch)
          // alert(isMatch)
          console.log('LOGIN API ROUTE', `${process.env.EXPO_PUBLIC_APP_URL}/login`)
          const apiBaseUrl = await getServerUrl();

          try {
            // const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/login`, {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify({ password, phoneNumber, apiBaseUrl }),
            // });
            
            // const data = await response.json();
            // console.log('Response Data From Login')
            // console.log(data)

            // const { phoneNumber, password, apiBaseUrl } = await request.json();
    console.log('phone_number', phoneNumber);
    console.log('apiBaseUrl', apiBaseUrl);

    const session_id = await SecureStore.getItemAsync('odoo_session_id');
       
    const options = {
      method: 'POST',
      url: `${apiBaseUrl}/api/fo/login`,
      headers: {
        cookie: `frontend_lang=en_GB; session_id=${session_id}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          phone_number: phoneNumber,
          password,
          device_info: {
            deviceModel: Device.modelName || 'Unknown', 
            deviceName: Device.deviceName || 'Unknown'
          }
        }
      }
    };

    console.log('Sending request to:', options.url);
    console.log('Request payload:', JSON.stringify(options.data));
    
    // Make the request to the Odoo API
    const response = await axios.request(options);
    console.log('API response status:', response.status);
    console.log('API response data:', JSON.stringify(response.data));
    const data = response.data;
    
    // If login is successful, generate JWT
    // if (response.data?.result?.success) {
    //   const employeeData = response.data.result.employee;
    //   const sessionToken = response.data.result.session_token;

    console.log('data', data)

            if (data.result.success) {
              // setSession(JSON.stringify(data.user));
              console.log('Data from oddo employee login')
              console.log(data)
              const userData = {
                userId: data.result.employee.id,
                name: data.result.employee.name,
                workPhone: phoneNumber,
                session_id: data.result.session_token,
                session_expiry: data.result.expiry
              };

              setSession(JSON.stringify(userData));
              await SecureStore.setItemAsync('odoo_custom_session_id', data.result.session_token);
              await SecureStore.setItemAsync('odoo_employee_id', String(data.result.employee.id));
              return true;
            } else {
              setError('Invalid response from server');
              return false;
            }

            
            return true;
          } catch (error) {
            console.error('Password verification error:', error);
            setError('Error verifying password');
            return false;
          }
        },
        localLogin: async (password: string, mobileAppPasswordHash: string, mobile_app_password_salt: string, fullName: string, workPhone: string, userId: string) => {
          setError(null);
          console.log(password, mobileAppPasswordHash)
          // alert(password)
          // alert(mobileAppPasswordHash)
          // const isMatch = bcrypt.compareSync(password, mobileAppPasswordHash);
          // console.log('isMatch', isMatch)
          // alert(isMatch)
          const passwordWithSalt = password + mobile_app_password_salt;

          const calculatedHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            passwordWithSalt
          );

          const isMatch = calculatedHash === mobileAppPasswordHash;

          try {
            // const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/localLogin`, {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify({ password, mobileAppPasswordHash }),
            // });
            
            // const data = await response.json();
            
            if (!isMatch) {
              setError('Invalid password');
              return false;
            }

            if (isMatch) {
                    // Save important user data
                    const userData = {

                      userId: userId,
                      name: fullName,
                      workPhone: workPhone,
                      session_id: await SecureStore.getItemAsync('odoo_custom_session_id'),
                      session_expiry: Date.now() + 1000 * 60 * 60 * 24 * 30 // 30 days
                    };

                    
                    setSession(JSON.stringify(userData));
                    return true;
            }
            
            return true;
          } catch (error) {
            console.error('Password verification error:', error);
            setError('Error verifying password');
            return false;
          }

          // try {
          //   // Get the server URL and database
          //   const apiBaseUrl = await getServerUrl();
          //   const database = await getDatabase();
            
          //   console.log('Making request to:', `${apiBaseUrl}/web/session/authenticate`);
          //   console.log('Using database:', database);
            
          //   const options = {
          //     method: 'POST',
          //     url: `${apiBaseUrl}/web/session/authenticate`,
          //     headers: {
          //       'Content-Type': 'application/json',
          //     },
          //     data: {
          //       jsonrpc: '2.0',
          //       params: {
          //         db: database,
          //         login,
          //         password
          //       }
          //     }
          //   };

          //   const response = await axios.request(options);
            
          //   // Extract the session ID cookie from the response
          //   const cookies = response.headers['set-cookie'];
          //   let sessionId = '';
            
          //   if (cookies && cookies.length) {
          //     // Find and extract the session_id cookie
          //     const sessionCookie = cookies.find((cookie: string) => cookie.includes('session_id='));
          //     if (sessionCookie) {
          //       sessionId = sessionCookie.split(';')[0].split('=')[1];
          //       // Store the session ID securely
          //       await storeSessionId(sessionId);
          //     }
          //   }
            
          //   if (response.data && response.data.result) {
          //     // Save important user data
          //     const userData: OdooUserData = {
          //       uid: response.data.result.uid,
          //       name: response.data.result.name,
          //       username: response.data.result.username,
          //       partner_id: response.data.result.partner_id,
          //       is_admin: response.data.result.is_admin,
          //       session_id: sessionId
          //     };
              
          //     // Store the user data
          //     setSession(JSON.stringify(userData));
          //     return true;
          //   } else {
          //     setError('Invalid response from server');
          //     return false;
          //   }
          // } catch (error) {
          //   console.error('Login error:', error);
          //   setError(error instanceof Error ? error.message : 'Authentication failed');
          //   return false;
          // }
        },
        adminLogin: async (login: string, password: string, powerSyncURI: string) => {
          setError(null);
          try {
            // Get the server URL and database
            const apiBaseUrl = await getServerUrl();
            const database = await getDatabase();
            
            console.log('Making request to:', `${apiBaseUrl}/web/session/authenticate`);
            console.log('Using database:', database);
            console.log('login', login)
            console.log('password length:', password?.length)
            
            if (!apiBaseUrl) {
              setError('Server URL is missing. Please check settings.');
              return false;
            }
            
            const options = {
              method: 'POST',
              url: `${apiBaseUrl}/web/session/authenticate`,
              headers: {
                'Content-Type': 'application/json',
              },
              data: {
                jsonrpc: '2.0',
                params: {
                  db: database,
                  login,
                  password
                }
              }
            };

            console.log('Sending authentication request...');
            
            const response = await axios.request(options);
            
            // Extract the session ID cookie from the response
            const cookies = response.headers['set-cookie'];
            let sessionId = '';

            console.log('RESPONSE', response)
            
            if (cookies && cookies.length) {
              // Find and extract the session_id cookie
              const sessionCookie = cookies.find((cookie: string) => cookie.includes('session_id='));
              console.log('sessionCookie')
              console.log(sessionCookie)
              

              if (sessionCookie) {
                sessionId = sessionCookie.split(';')[0].split('=')[1];
                // Store the session ID securely
                await storeSessionId(sessionId);
                axios.defaults.headers.common['cookie'] = `frontend_lang=en_GB; ${sessionId}`;
                await SecureStore.setItemAsync('odoo_admin_session_id', sessionCookie);
                await SecureStore.setItemAsync('power_sync_uri', powerSyncURI);
                console.log('sessionId', sessionId)
                console.log('sessionCookie2', sessionCookie)
                console.log('PowerSync URI saved:', powerSyncURI);
              }
            }
            
            if (response.data && response.data.result) {
              console.log('Admin login successful');
              return true;
            } else {
              console.log(response.data)
              setError('Invalid response from server');
              return false;
            }
          } catch (error) {
            console.error('Login error:', error);
            setError(error instanceof Error ? error.message : 'Authentication failed');
            return false;
          }
        },
        signOut: async () => {
          // Clear session from secure storage
          await SecureStore.deleteItemAsync('odoo_session_id');
          // await SecureStore.deleteItemAsync('odoo_custom_session_id');
          // await SecureStore.deleteItemAsync('odoo_employee_id');
          await SecureStore.deleteItemAsync('employee_jwt');
          setSession(null);
        },
        session: session ? JSON.parse(session) : null,
        isLoading,
        error,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
