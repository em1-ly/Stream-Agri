import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const apiClient = axios.create({
  baseURL: '', // Will be set dynamically
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to dynamically set the baseURL and add the auth token to every request
apiClient.interceptors.request.use(
  async (config) => {
    const serverIP = await SecureStore.getItemAsync('odoo_server_ip');
    const token = await SecureStore.getItemAsync('odoo_custom_session_id');

    if (serverIP) {
      // Ensure the URL starts with https://
      if (serverIP.startsWith('http://') || serverIP.startsWith('https протокол://')) {
        config.baseURL = serverIP;
      } else {
        config.baseURL = `https://${serverIP}`;
      }
    } else {
      // Handle the case where the server IP is not set
      console.error('Odoo server IP is not configured.');
      return Promise.reject(new axios.Cancel('Odoo server IP is not configured.'));
    }

    if (token) {
      config.headers['X-FO-Token'] = token;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to log more detailed network errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Axios Error:', JSON.stringify(error, null, 2));
    if (error.request) {
      console.error('Request Data:', error.request._data);
      console.error('Request Headers:', error.request._headers);
    }
    return Promise.reject(error);
  }
);


export const updateBaleDataAPI = (barcode: string, updates: Record<string, any>) => {
  return apiClient.patch('/api/fo/data-capturing/bale', {
    jsonrpc: '2.0',
    params: {
        barcode,
        updates,
    },
  });
};

export default apiClient;
