import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';

// Create the context
const NetworkContext = createContext({ isConnected: false });

// Create a provider component
export const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Subscribe to network state updates
    console.log("Subscribing to network state updates")
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      console.log("Network state updated", state.isConnected)
    });

    // Check initial state
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? false);
      console.log("Initial network state", state.isConnected)
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
};

// Create a custom hook for easy usage
export const useNetwork = () => useContext(NetworkContext);