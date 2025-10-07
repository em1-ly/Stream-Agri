import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';

export default function BarcodeScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const scanType = params.scanType as string || 'document'; // 'document' or 'bale'

  useEffect(() => {
    const getCameraPermissions = async () => {
      try {
        console.log('Requesting camera permissions...');
        const { status } = await Camera.requestCameraPermissionsAsync();
        console.log('Camera permission status:', status);
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Error requesting camera permissions:', error);
        Alert.alert('Error', 'Failed to request camera permissions');
        setHasPermission(false);
      }
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    console.log('Barcode scanned:', type, data, 'for', scanType);
    setScanned(true);
    
    if (scanType === 'bale') {
      // For bale barcode, pass back the scanned barcode and the document number
      const docNum = params.documentNumber as string;
      router.push({
        pathname: '/receiving/add-bale-to-gd-note',
        params: { 
          scannedBaleBarcode: data, 
          documentNumber: docNum,
          preserveState: 'true' 
        }
      });
    } else {
      // For document number, use push to start fresh
      router.push({
        pathname: '/receiving/add-bale-to-gd-note',
        params: { scannedBarcode: data }
      });
    }
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white text-lg">Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-white text-lg text-center mb-5">
          Camera permission is required to scan barcodes
        </Text>
        <TouchableOpacity
          className="bg-[#65435C] rounded-lg py-3 px-6"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'codabar', 'upc_a', 'upc_e'],
        }}
      >
        <View className="flex-1">
          {/* Close button */}
          <TouchableOpacity
            className="absolute top-12 right-5 bg-black/50 rounded-full p-3"
            onPress={() => router.back()}
          >
            <X color="white" size={24} />
          </TouchableOpacity>

          {/* Scanning frame */}
          <View className="flex-1 items-center justify-center">
            <View className="w-72 h-72 border-2 border-white rounded-lg">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#65435C]" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#65435C]" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#65435C]" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#65435C]" />
            </View>
            <Text className="text-white text-lg mt-8 text-center px-5">
              {scanType === 'bale' ? 'Scan Bale Barcode' : 'Scan Document Number'}
            </Text>
            <Text className="text-white text-sm mt-2 text-center px-5 opacity-80">
              Position the barcode within the frame
            </Text>
          </View>

          {scanned && (
            <View className="absolute bottom-10 left-0 right-0 items-center">
              <TouchableOpacity
                className="bg-[#65435C] rounded-lg py-3 px-6"
                onPress={() => setScanned(false)}
              >
                <Text className="text-white font-bold">Tap to Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}
