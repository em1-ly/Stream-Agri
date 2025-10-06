import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Linking } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';

export default function BarcodeScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [bounds, setBounds] = useState(null);
  const router = useRouter();

  // --- Start: Handle Camera Permission ---
  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleOpenSettings = () => {
    Linking.openSettings();
  };
  // --- End: Handle Camera Permission ---


  // --- Start: Barcode Scanning Logic ---
  const handleBarCodeScanned = ({ type, data, bounds: scannedBounds }) => {
    if (!scanned) {
        console.log(`Scanned data: ${data}`);
        console.log('Received bounds:', scannedBounds);
        setScanned(true);
        setScannedData(data);
        setBounds(scannedBounds);
    }
  };
  // --- End: Barcode Scanning Logic ---


  // --- Start: Navigation and Reset ---
  const handleUseCode = () => {
    if (scannedData) {
      router.replace({ pathname: '/(app)/receiving/sequencing-scanner', params: { scannedBarcode: scannedData } });
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setScannedData(null);
    setBounds(null);
  };
  // --- End: Navigation and Reset ---


  // --- Start: Render UI ---
  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return (
        <View style={styles.container}>
            <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
            <Button onPress={handleOpenSettings} title="Grant Permission in Settings" />
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "pdf417", "ean13", "code128"],
        }}
        style={StyleSheet.absoluteFillObject}
      />

      {bounds && (
        <View
          style={{
            position: 'absolute',
            borderColor: '#00FF00',
            borderWidth: 4,
            borderRadius: 10,
            left: bounds.origin.x,
            top: bounds.origin.y,
            width: bounds.size.width,
            height: bounds.size.height,
          }}
        />
      )}

      {scanned && (
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
      flexDirection: 'column',
      justifyContent: 'center',
      backgroundColor: 'black'
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