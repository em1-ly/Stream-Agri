import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, Alert, Platform, Vibration } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { X, ArrowLeft, Flashlight, FlashlightOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface BarcodeScannerProps {
  scanType?: 'document' | 'bale';
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  displayInfo?: {
    barcode?: string;
    row?: string;
    progress?: { scanned: number; total: number } | null;
    gdnNumber?: string;
  };
  stayOnCamera?: boolean; // If true, don't navigate away after scanning
  scanStatus?: 'idle' | 'processing' | 'success' | 'error'; // Status for continuous scanning mode
}

export default function BarcodeScanner({ 
  scanType = 'document', 
  onBarcodeScanned, 
  onClose,
  title,
  subtitle,
  displayInfo,
  stayOnCamera = false,
  scanStatus = 'idle'
}: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [highlightedBarcode, setHighlightedBarcode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

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

  const toggleTorch = async () => {
    console.log('🔦 Toggling torch from', torchOn, 'to', !torchOn);
    
    try {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.log('Haptic feedback not available');
    }
    
    setTorchOn(!torchOn);
  };

  // Debug torch state changes
  useEffect(() => {
    console.log('🔦 Torch state changed to:', torchOn);
  }, [torchOn]);

  const handleDetectedCode = async (type: string, value: string) => {
    if (isScanning) return; // Prevent multiple scans
    
    setIsScanning(true);
    
    // Do not modify  the scanned value; preserve exactly as read by camera
    let normalized = value;

    // If QR code, accept as-is and skip Code 39 validation
    const isQr = type === 'qr' || type === 'org.iso.qr';
    if (!isQr) {
      // Validate check digit ONLY for Code 39 bales (10-char)
      if (!validateCheckDigit(normalized)) {
        // Show error feedback
        Vibration.vibrate([0, 200, 100, 200]); // Error pattern
        setScanError('Invalid Barcode'); // Show temporary error
        
        // Reset after a delay to allow scanning again
        setTimeout(() => {
          setScanError(null);
          setIsScanning(false);
        }, 2000);
        return;
      }
    }

    // On success, show the highlighted barcode
    setHighlightedBarcode(value);

    // Play success beep and haptic feedback
    try {
      // Use vibration for beep sound
      Vibration.vibrate(200); // Short beep
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Could not play sound or haptic:', error);
    }

    // If stayOnCamera is true, don't block scanning - allow continuous scans
    if (!stayOnCamera) {
      setScanned(true);
    }

    // Call the callback after a brief delay to show the highlighted barcode
    setTimeout(() => {
      onBarcodeScanned(normalized);
      
      // If stayOnCamera is true, reset scanning state after callback so user can scan again
      if (stayOnCamera) {
        setTimeout(() => {
          setIsScanning(false);
          setHighlightedBarcode(null);
        }, 1000); // Show success for 1 second, then allow next scan
      }
    }, 10);
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
        <Text className="text-white text-lg text-center mb-5">
          Camera permission is required to scan barcodes
        </Text>
        <TouchableOpacity
          className="bg-[#65435C] rounded-lg py-3 px-6"
          onPress={onClose}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#65435C] py-10">
      {/* Header with buttons and info - Moved outside CameraView for better touch handling */}
      <View className="h-24 bg-black flex-row items-center justify-between px-5 pt-4 z-50">
        <View className="flex-1 flex-row items-center">
          <TouchableOpacity
            className="bg-gray-800 rounded-full p-3 mr-3"
            onPress={onClose}
            activeOpacity={0.7}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          
          {/* Display barcode and row info at top left */}
          {(displayInfo?.barcode || displayInfo?.row || displayInfo?.progress || displayInfo?.gdnNumber) && (
            <View className="bg-gray-800 rounded-lg px-3 py-2">
              {displayInfo.gdnNumber && (
                <Text className="text-white text-xs font-semibold">
                  GDN: {displayInfo.gdnNumber}
                </Text>
              )}
              {displayInfo.barcode && (
                <Text className="text-white text-xs font-semibold mt-1">
                  Barcode: {displayInfo.barcode}
                </Text>
              )}
              {displayInfo.row && (
                <Text className="text-white text-xs mt-1">
                  Row: {displayInfo.row}
                </Text>
              )}
              {displayInfo.progress && (
                <Text className="text-white text-xs mt-1">
                  {displayInfo.progress.total > 0 
                    ? `Progress: ${displayInfo.progress.scanned}/${displayInfo.progress.total}`
                    : `Scanned: ${displayInfo.progress.scanned}`
                  }
                </Text>
              )}
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            className="bg-gray-800 rounded-full p-3"
            onPress={toggleTorch}
            activeOpacity={0.7}
          >
            {torchOn ? (
              <FlashlightOff color="white" size={22} />
            ) : (
              <Flashlight color="white" size={22} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-gray-800 rounded-full p-3"
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X color="white" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={(scanned && !stayOnCamera) ? undefined : ({ type, data }) => handleDetectedCode((type || '').toLowerCase(), data || '')}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'codabar', 'upc_a', 'upc_e', 'pdf417']
        }}
      >
        <View className="flex-1">
          {/* Dark top bar */}
          <View 
            className="absolute" 
            style={{ 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '25%',
              backgroundColor: '#000000'
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
              backgroundColor: '#000000'
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
              backgroundColor: '#000000'
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
              backgroundColor: '#000000'
            }} 
          />

          {/* Scanning frame */}
          <View className="flex-1 items-center justify-center z-10">
            <View className="w-72 h-72 border-2 border-white rounded-lg relative">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#65435C]" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#65435C]" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#65435C]" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#65435C]" />
              
              {/* Highlighted barcode overlay */}
              {highlightedBarcode && (
                <View className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <View className="bg-green-500 px-4 py-2 rounded-lg">
                    <Text className="text-white font-bold text-lg">{highlightedBarcode}</Text>
                  </View>
                </View>
              )}
            </View>
            
            <Text className="text-white text-lg mt-8 text-center px-5">
              {title || (scanType === 'bale' ? 'Scan Bale Barcode' : 'Scan Document Number')}
            </Text>
            <Text className={`text-sm mt-2 text-center px-5 ${
              scanStatus === 'success' ? 'text-green-400 font-bold' :
              scanStatus === 'error' ? 'text-red-400 font-bold' :
              scanStatus === 'processing' ? 'text-yellow-400 font-bold' :
              'text-white opacity-80'
            }`}>
              {subtitle || 'Position the barcode within the frame'}
            </Text>
            
            {scanError && (
              <Text className="text-red-400 text-lg mt-4 text-center px-5 font-bold">
                ❌ {scanError}
              </Text>
            )}
            
          </View>

          {scanned && !stayOnCamera && (
            <View className="absolute bottom-10 left-0 right-0 items-center">
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
      </CameraView>
    </View>
  );
}
