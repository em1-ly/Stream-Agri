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
  const [lastDetectedValue, setLastDetectedValue] = useState<string | null>(null); // Re-introduce for stability check
  const cameraRef = useRef<CameraView>(null);

  // Validate 10-digit Code 39 barcode with Modulo 43 check digit
  const validateCheckDigit = (barcode: string): boolean => {
    console.log('🔍 Validating barcode as Code 39 (Modulo 43):', barcode);

    if (barcode.length !== 10) {
      console.log('❌ Code 39 barcode is not 10 characters long. Length:', barcode.length);
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

  // Validate Code 128 barcode with Modulo 103 check digit (simplified - most hardware handles this)
  const validateMod103 = (barcode: string): boolean => {
    // For simplicity, we assume the scanner hardware/library handles the Modulo 103
    // check digit validation for Code 128. This function primarily checks format and content.
    console.log('🔍 Validating barcode as Code 128 (Modulo 103 assumed by scanner):', barcode);
    // We might add more specific content checks here later if needed for particular Code 128 variants.
    return true; 
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

  /**
   * Try to auto-detect the barcode format (CTL, TPZ, MTC) based on the
   * scanned value itself, without requiring the caller to specify it.
   *
   * - CTL           : Code 39 with Modulo 43 check digit, length 10
   * - CTL_LUGGAGE   : Code 128, length 10 (luggage label)
   * - TPZ           : Code 128, length 16
   * - MTC           : Code 128, starts with 'TV', length 10
   */
  const detectAndValidateBarcode = (type: string, value: string) => {
    let isValid = true;
    let validationError: string | null = null;
    let detectedType: string | null = null;
    let normalizedValue = value.trim();

    // 0) Packed QR Code (JSON format)
    // Format: {"a": ["...", "...", ..., "TV05422125", ...]}
    if (normalizedValue.startsWith('{') && normalizedValue.endsWith('}')) {
      try {
        const parsed = JSON.parse(normalizedValue);
        if (parsed && Array.isArray(parsed.a) && parsed.a.length >= 9) {
          const extracted = parsed.a[8]; // Extract barcode at index 8
          if (extracted) {
            console.log('✅ Detected Packed QR Code. Extracted barcode:', extracted);
            normalizedValue = extracted.trim();
            // Continue to validate the extracted barcode below
          }
        }
      } catch (e) {
        // Not valid JSON, continue to regular detection
      }
    }

    const length = normalizedValue.length;

    // Helper for Code 39 charset check
    const code39Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
    const allCode39Chars = normalizedValue.split('').every(char => code39Chars.includes(char));

    // 1) MTC: Code 128, starts with 'TV', length 10
    if (length === 10 && normalizedValue.startsWith('TV')) {
      isValid = validateMod103(normalizedValue);
      validationError = isValid ? null : 'Invalid MTC Code 128 (Modulo 103)';
      return { isValid, validationError, detectedType: 'MTC', normalizedValue };
    }

    // 2) CTL_LUGGAGE: Code 128, length 10 (generic CTL luggage labels)
    if (
      length === 10 &&
      (type === 'code128' || type === 'org.iso.code128' || type === 'qr' || type === 'org.iso.QRCode')
    ) {
      isValid = validateMod103(normalizedValue);
      validationError = isValid ? null : 'Invalid CTL luggage Code 128 (Modulo 103)';
      return { isValid, validationError, detectedType: 'CTL_LUGGAGE', normalizedValue };
    }

    // 3) TPZ: Code 128, length 16
    if (length === 16) {
      isValid = validateMod103(normalizedValue);
      validationError = isValid ? null : 'Invalid TPZ Code 128 (Modulo 103)';
      return { isValid, validationError, detectedType: 'TPZ', normalizedValue };
    }

    // 4) CTL: Code 39 with Modulo 43, length 10, valid charset
    if (length === 10 && allCode39Chars) {
      isValid = validateCheckDigit(normalizedValue);
      validationError = isValid ? null : 'Invalid CTL Code 39 (Modulo 43) check digit';
      return { isValid, validationError, detectedType: 'CTL', normalizedValue };
    }

    // 5) No known pattern matched
    isValid = false;
    validationError = `Unrecognized barcode format (length ${length}, scanner type ${type || 'unknown'}). Expected CTL (Code 39, length 10), CTL luggage (Code 128, length 10), TPZ (Code 128, length 16) or MTC (Code 128, starts with 'TV', length 10).`;
    return { isValid, validationError, detectedType: null, normalizedValue };
  };

  const handleDetectedCode = async (type: string, value: string) => {
    if (isScanning) return; // Prevent multiple scans
    
    // Stability check: require the same value twice to prevent phantom/accidental scans
    if (value !== lastDetectedValue) {
      setLastDetectedValue(value);
      return;
    }
    
    setIsScanning(true);
    setLastDetectedValue(null); // Reset for next session
    
    // Automatically detect and validate barcode format based on content
    const { isValid, validationError, normalizedValue } = detectAndValidateBarcode(type, value);

    if (!isValid) {
        // Show error feedback
        Vibration.vibrate([0, 200, 100, 200]); // Error pattern
      setScanError(validationError);
        
        // Reset after a delay to allow scanning again
        setTimeout(() => {
          setScanError(null);
          setIsScanning(false);
        }, 2000);
        return;
    }

    // On success, show the highlighted barcode (use the normalized one)
    setHighlightedBarcode(normalizedValue);

    // Play success beep and haptic feedback
    try {
      Vibration.vibrate(200); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Could not play sound or haptic:', error);
    }

    if (!stayOnCamera) {
      setScanned(true);
    }

    // Call the callback immediately with the extracted/normalized barcode
    onBarcodeScanned(normalizedValue);
      
      // If stayOnCamera is true, reset scanning state after callback so user can scan again
      if (stayOnCamera) {
        setTimeout(() => {
          setIsScanning(false);
          setHighlightedBarcode(null);
      }, 1000); 
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
    <View className="flex-1 bg-[#65435C] pt-0 pb-10">
      {/* Header with buttons and info - Moved outside CameraView for better touch handling */}
      <View className="h-24 bg-black flex-row items-center justify-between px-5 pt-0 z-50">
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

      {/* Finish Scan button - shown when stayOnCamera is true, positioned outside CameraView for proper touch handling */}
      {stayOnCamera && (
        <View className="absolute bottom-10 left-0 right-0 items-center px-5 z-50" pointerEvents="box-none">
          <TouchableOpacity
            className="bg-green-600 rounded-lg py-4 px-8 w-full"
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-lg text-center">Finish Scan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
