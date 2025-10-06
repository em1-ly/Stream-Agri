import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, AppState, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useFocusEffect } from 'expo-router';

export default function BarcodeScanner() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isActive, setIsActive] = useState(true);

  const [scannedData, setScannedData] = useState(null);
  const [bounds, setBounds] = useState(null);

  // --- Start: Handle Camera Permission ---
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // If the user denied permission, show a button to open settings
  const handleOpenSettings = () => {
    Linking.openSettings();
  };
  // --- End: Handle Camera Permission ---


  // --- Start: Handle App State (e.g., app goes to background) ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setIsActive(true); // When screen is focused
      return () => {
        setIsActive(false); // When screen is unfocused
      };
    }, [])
  );
  // --- End: Handle App State ---


  // --- Start: Barcode Scanning Logic ---
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'code-128'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && !scannedData) {
        const code = codes[0];
        console.log('Scanned Barcode:', code);
        setScannedData(code.value);
        setBounds(code.frame);
      }
    },
  });
  // --- End: Barcode Scanning Logic ---


  // --- Start: Navigation and Reset ---
  const handleUseCode = () => {
    if (scannedData) {
      router.replace({ pathname: '/(app)/receiving/sequencing-scanner', params: { scannedBarcode: scannedData } });
    }
  };

  const handleScanAgain = () => {
    setScannedData(null);
    setBounds(null);
  };
  // --- End: Navigation and Reset ---


  // --- Start: Render UI ---
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={handleOpenSettings} title="Grant Permission" />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
      />

      {bounds && (
        <View
          style={[styles.boundingBox, {
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
          }]}
        />
      )}

      {scannedData && (
        <View style={styles.buttonContainer}>
          <Text style={styles.scannedDataText}>Scanned: {scannedData}</Text>
          <Button title={'Use this Code'} onPress={handleUseCode} />
          <Button title={'Tap to Scan Again'} onPress={handleScanAgain} />
        </View>
      )}
    </View>
  );
}
// --- End: Render UI ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  boundingBox: {
    position: 'absolute',
    borderColor: '#00FF00',
    borderWidth: 4,
    borderRadius: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
  },
  scannedDataText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  }
});