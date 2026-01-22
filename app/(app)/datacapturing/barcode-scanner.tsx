import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, Platform, Vibration } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { X, ArrowLeft, Flashlight, FlashlightOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function BarcodeScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [highlightedBarcode, setHighlightedBarcode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = (params.returnTo as string) || '/(app)/datacapturing'; 

  // Validate 10-digit Code 39 barcode with Modulo 43 check digit
  const validateCheckDigit = (barcode: string): boolean => {
    console.log('🔍 Validating barcode as Code 39:', barcode);

    if (barcode.length !== 10) {
      console.log('❌ Barcode is not 10 characters long for Code 39 validation');
      return false;
    }

    const code39Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
    const data = barcode.slice(0, -1);
    const checkChar = barcode.slice(-1);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const value = code39Chars.indexOf(char);
      
      if (value === -1) {
        console.log(`❌ Invalid Code 39 character found: ${char}`);
        return false; // Invalid character
      }
      
      sum += value;
    }
    
    const checkDigitIndex = sum % 43;
    const calculatedCheckChar = code39Chars[checkDigitIndex];
    
    const isValid = calculatedCheckChar === checkChar;

    console.log(`🔍 Code 39 validation: Data=${data}, Check=${checkChar}, Calculated=${calculatedCheckChar}, Valid=${isValid}`);
      
    return isValid;
  };

  useEffect(() => {
    const getCameraPermissions = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Error requesting camera permissions:', error);
        setHasPermission(false);
      }
    };
    getCameraPermissions();
  }, []);

  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  const handleDetectedCode = async (type: string, value: string) => {
    if (isScanning) return; // Prevent multiple scans
    
    setIsScanning(true);
    
    let normalized = value;
    if (Platform.OS === 'ios' && type === 'ean-13' && value.length === 13 && value.startsWith('0')) {
      normalized = value.substring(1);
    }

    // Normalize leading/trailing asterisks and spaces for Code39-style barcodes or QR payloads
    // e.g. "*127512659 *" -> "127512659"
    // This runs for all types so QR codes that wrap the same value also benefit.
    // Normalize leading/trailing asterisks for Code39-style barcodes or QR payloads
    // e.g. "*127512659 *" -> "127512659 "
    normalized = normalized.replace(/^\*+|\*+$/g, '');

    if (!validateCheckDigit(normalized)) {
      Vibration.vibrate([0, 200, 100, 200]);
      setScanError('Invalid Barcode');

      setTimeout(() => {
        setScanError(null);
        setIsScanning(false);
      }, 2000);
      return;
    }

    setHighlightedBarcode(value);

    try {
      Vibration.vibrate(200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Could not play sound or haptic:', error);
    }

    setScanned(true);

    // Return immediately after detection to provide instant feedback
    // Defer navigation to next tick to ensure camera UI is responsive
    setTimeout(() => {
      router.replace({
        pathname: returnTo as any,
        params: { scannedBarcode: normalized }
      });
    }, 0);
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
      
      {/* Header - Solid black to match receiving component exactly */}
      <View className="h-24 bg-black flex-row items-center justify-between px-5 pt-10 z-50">
        <TouchableOpacity 
          className="bg-gray-800 rounded-full p-2.5" 
          onPress={() => router.back()}
        >
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        
        <TouchableOpacity
          className="bg-gray-800 rounded-full p-2.5"
          onPress={toggleTorch}
        >
          {torchOn ? <FlashlightOff color="white" size={24} /> : <Flashlight color="white" size={24} />}
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-gray-800 rounded-full p-2.5" 
          onPress={() => router.back()}
        >
          <X color="white" size={24} />
        </TouchableOpacity>
      </View>

      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={scanned ? undefined : ({ type, data }) => handleDetectedCode((type || '').toLowerCase(), data || '')}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'codabar', 'upc_a', 'upc_e', 'pdf417']
        }}
      >
        <View className="flex-1">
          {/* Darkened surrounding overlays - Solid black opacity */}
          <View className="absolute inset-0">
            {/* Dark top bar */}
            <View 
              className="absolute" 
              style={{ 
                top: 0, 
                left: 0, 
                right: 0, 
                height: '25%',
                backgroundColor: 'black'
              }} 
            />
            
            {/* Dark bottom bar */}
            <View 
              className="absolute" 
              style={{ 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: '25%',
                backgroundColor: 'black'
              }} 
            />
            
            {/* Dark left bar */}
            <View 
              className="absolute" 
              style={{ 
                left: 0, 
                top: '25%', 
                bottom: '25%',
                width: '18%',
                backgroundColor: 'black'
              }} 
            />
            
            {/* Dark right bar */}
            <View 
              className="absolute" 
              style={{ 
                right: 0, 
                top: '25%', 
                bottom: '25%',
                width: '18%',
                backgroundColor: 'black'
              }} 
            />
          </View>

          {/* Scanning frame - Centered within the clear area */}
          <View className="flex-1 items-center justify-center z-10">
            <View className="w-72 h-72 border-2 border-white rounded-lg relative">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#65435C]" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#65435C]" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#65435C]" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#65435C]" />
              
              {highlightedBarcode && (
                <View className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <View className="bg-green-500 px-4 py-2 rounded-lg">
                    <Text className="text-white font-bold text-lg">{highlightedBarcode}</Text>
                  </View>
                </View>
              )}
            </View>
            
            <Text className="text-white text-lg mt-8 text-center px-5">Scan Bale Barcode</Text>
            <Text className="text-white text-sm mt-2 text-center px-5 opacity-80">Position the barcode within the frame</Text>
            
            {scanError && <Text className="text-red-400 text-lg mt-4 text-center px-5 font-bold">❌ {scanError}</Text>}
            {highlightedBarcode && !scanError && <Text className="text-green-400 text-sm mt-2 text-center px-5 font-semibold">✅ Valid barcode detected!</Text>}
          </View>
        </View>
      </CameraView>

      {scanned && (
        <View className="absolute bottom-10 left-0 right-0 items-center z-30">
          <TouchableOpacity
            className="bg-[#65435C] rounded-lg py-3 px-6"
            onPress={() => {
              setScanned(false);
              setIsScanning(false);
              setHighlightedBarcode(null);
            }}
          >
            <Text className="text-white font-bold">Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
