import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';

type MessageType = 'info' | 'success' | 'error';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: any }>;
  placeholder: string;
}) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
    <View className="bg-gray-100 border border-gray-300 rounded-lg">
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        style={{ height: 50, color: value ? '#111827' : '#4B5563' }}
      >
        <Picker.Item label={placeholder} value="" color="#9CA3AF" />
        {items.map((item) => (
          <Picker.Item key={item.value} label={item.label} value={item.value} color="#374151" />
        ))}
      </Picker>
    </View>
  </View>
);

const WarehouseBaleScanScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    warehouseId?: string;
    locationId?: string;
    warehouseName?: string;
    locationName?: string;
    productId?: string;
    productName?: string;
    productTechnicalName?: string;
    defaultWeight?: string;
  }>();

  const [receivingMode, setReceivingMode] = useState<'by_bale' | 'by_pallet'>('by_bale');
  const [barcode, setBarcode] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [logisticsBarcode, setLogisticsBarcode] = useState('');
  const [receivedMass, setReceivedMass] = useState('');
  
  // Packed product specific fields
  const [operationNo, setOperationNo] = useState('');
  const [cropYear, setCropYear] = useState('');
  const [tobaccoType, setTobaccoType] = useState('');
  const [manufactureDate, setManufactureDate] = useState<string | null>(null);
  const [productType, setProductType] = useState('');
  const [runCaseNo, setRunCaseNo] = useState('');
  const [packageNo, setPackageNo] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [gradeName, setGradeName] = useState('');
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [mass, setMass] = useState('');
  const [cnt, setCnt] = useState('1');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [scannedBales, setScannedBales] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'product' | 'logistics' | 'qr'>('product');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const massInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const warehouseLabel = params.warehouseName || 'Warehouse';
  const locationLabel = params.locationName || 'Location';
  const productLabel = params.productName || 'Product';
  const isPackedProduct = params.productTechnicalName === 'packed_product';

  const resetPackedProductFields = () => {
    setOperationNo('');
    setCropYear('');
    setTobaccoType('');
    setManufactureDate(null);
    setProductType('');
    setRunCaseNo('');
    setPackageNo('');
    setGrade(null);
    setGradeName('');
    setGross('');
    setTare('');
    setMass('');
    setCnt('1');
  };

  const parseQrCode = (qrCodeData: string) => {
    try {
      // First try to parse as JSON
      if (qrCodeData.trim().startsWith('{') && qrCodeData.trim().endsWith('}')) {
        const jsonData = JSON.parse(qrCodeData);
        if (jsonData.a && Array.isArray(jsonData.a)) {
          const values = jsonData.a;
          if (values.length >= 12) {
            const data: any = {};
            if (values[0]) data.operation_no = String(values[0]);
            if (values[1]) data.crop_year = String(values[1]);
            if (values[2] && values[6]) {
              // values[2] is YYYY/MM/DD, values[6] is HH:MM:SS AM/PM
              // Convert to Odoo standard format: YYYY-MM-DD HH:MM:SS (24h)
              try {
                const datePart = String(values[2]).replace(/\//g, '-');
                const timeStr = String(values[6]);
                const timeMatch = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
                if (timeMatch) {
                  let [_, hours, minutes, seconds, ampm] = timeMatch;
                  let h = parseInt(hours, 10);
                  if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
                  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
                  const hStr = h.toString().padStart(2, '0');
                  data.manufacture_date = `${datePart} ${hStr}:${minutes}:${seconds}`;
                } else {
                  data.manufacture_date = `${datePart} ${timeStr}`;
                }
              } catch (e) {
                data.manufacture_date = `${values[2]} ${values[6]}`;
              }
            }
            if (values[3]) data.product_type = String(values[3]);
            if (values[4]) data.run_case_no = String(values[4]);
            if (values[5]) data.package_no = String(values[5]);
            if (values[7]) data.grade_name = String(values[7]);
            if (values[8]) data.barcode = String(values[8]);
            if (values[9]) data.gross = String(values[9]);
            if (values[10]) data.tare = String(values[10]);
            if (values[11]) data.tobacco_type = String(values[11]);
            
            if (data.gross && data.tare) {
              data.mass = String(Number(data.gross) - Number(data.tare));
            }
            return data;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing QR code', e);
    }
    return null;
  };

  const handleScan = async () => {
    Keyboard.dismiss();
    const effectiveBarcode = barcode;
    if (!params.warehouseId || !params.locationId || !params.productId) {
      Alert.alert('Missing context', 'Warehouse, Location or Product is missing. Go back and select them again.');
      return;
    }

    if (receivingMode === 'by_bale' && !effectiveBarcode) {
      setMessage('Please enter a carton barcode!');
      setMessageType('error');
      return;
    }

    // For by_bale mode: match warehouse_carton_scan_wizard.action_scan_carton logic
      if (receivingMode === 'by_bale') {
      try {
        // 1) Check if carton already exists (mirror wizard validation)
        const existingCarton = await powersync.getOptional<any>(
          `SELECT id FROM warehouse_shipped_bale WHERE barcode = ? LIMIT 1`,
          [effectiveBarcode]
        );

        if (existingCarton) {
          setMessage(`Carton '${effectiveBarcode}' is already received!`);
          setMessageType('error');
          setBarcode('');
          return;
        }

        // 2) OFFLINE CREATE: insert carton into local warehouse_shipped_bale
        const currentWeight = receivedMass
          ? Number(receivedMass)
          : (params.defaultWeight ? Number(params.defaultWeight) : 0.0);

        const nowIso = new Date().toISOString();
        const newCartonId = uuidv4();

        // If it's a packed product and we have a grade name but no grade ID, try to find the ID
        let effectiveGradeId = grade;
        if (isPackedProduct && gradeName && !effectiveGradeId) {
          const foundGrade = await powersync.getOptional<any>(
            `SELECT id FROM warehouse_bale_grade WHERE name = ? LIMIT 1`,
            [gradeName]
          );
          if (foundGrade) {
            effectiveGradeId = String(foundGrade.id);
          }
        }

        await powersync.execute(
          `INSERT INTO warehouse_shipped_bale (
             id,
             pallet_id,
             barcode,
             logistics_barcode,
             returned,
             location_id,
             product_id,
             grade,
             original_grade,
             lot_number,
             mass,
             received_mass,
             price,
             grower_number,
             warehouse_id,
             dispatched,
             received,
             received_date_time,
             received_by,
             stacked_by,
             dispatch_date_time,
             stack_date_time,
             dispatched_by_id,
             transfered_by,
             transfered_date_time,
             stock_status,
             operation_type,
             manual_bale_resolved,
             operation_no,
             qr_code,
             crop_year,
             tobacco_type,
             manufacture_date,
             product_type,
             run_case_no,
             package_no,
             tare,
             gross,
             cnt,
             create_date,
             write_date
           )
           VALUES (?, NULL, ?, ?, 0, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, 0, 1, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'in_stock', 'received', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCartonId,
            effectiveBarcode,
            logisticsBarcode || null,
            Number(params.locationId),
            Number(params.productId),
            effectiveGradeId ? Number(effectiveGradeId) : null,
            currentWeight,
            currentWeight,
            Number(params.warehouseId),
            nowIso,
            isPackedProduct ? operationNo || null : null,
            isPackedProduct ? qrCode || null : null,
            isPackedProduct ? cropYear || null : null,
            isPackedProduct ? tobaccoType || null : null,
            isPackedProduct ? manufactureDate || null : null,
            isPackedProduct ? productType || null : null,
            isPackedProduct ? runCaseNo || null : null,
            isPackedProduct ? packageNo || null : null,
            isPackedProduct ? (tare ? Number(tare) : null) : null,
            isPackedProduct ? (gross ? Number(gross) : null) : null,
            isPackedProduct ? (cnt ? Number(cnt) : 1) : null,
            nowIso,
            nowIso,
          ]
        );

        // Success: update message and count (local only, server sync happens via Connector uploadData)
        setMessage(`${productLabel} product '${effectiveBarcode}' received successfully (offline).`);
        setMessageType('success');
        setScannedBales(prev => prev + 1);

        // Clear only the barcode, maintain weight and logistics_barcode for next scan (like wizard)
        setBarcode('');
        // Keep receivedMass and logisticsBarcode for next scan

        // If packed product, clear the packed product fields for next scan (like wizard)
        if (isPackedProduct) {
          resetPackedProductFields();
        }

        // Automatically open camera for next scan
        setTimeout(() => {
          Keyboard.dismiss();
          setScannerTarget('product');
          setScannerVisible(true);
        }, 300); // Small delay to show success message
      } catch (error: any) {
        console.error('Carton scan error', error);
        const msg =
          error?.response?.data?.message ||
          error?.message ||
          'System error while scanning. Please try again.';
        setMessage(msg);
        setMessageType('error');
        setBarcode('');
      }
      return;
    }

    // For by_pallet mode: keep existing pallet validation logic
    if (receivingMode === 'by_pallet') {
      try {
        const pallet = await powersync.getOptional<any>(
          `SELECT id, pallet_capacity, current_load
           FROM warehouse_pallet
           WHERE barcode = ? OR logistics_barcode = ?
           LIMIT 1`,
          [effectiveBarcode, effectiveBarcode]
        );

        if (!pallet) {
          setMessage(`❌ Pallet '${effectiveBarcode}' not found.`);
          setMessageType('error');
          return;
        }

        if (
          typeof pallet.pallet_capacity === 'number' &&
          typeof pallet.current_load === 'number' &&
          pallet.pallet_capacity > 0 &&
          pallet.current_load >= pallet.pallet_capacity
        ) {
          setMessage(
            `❌ Pallet is full (${pallet.current_load}/${pallet.pallet_capacity} products).`
          );
          setMessageType('error');
          return;
        }

        // TODO: Implement pallet receiving API call if needed
        setMessage('Pallet receiving not yet implemented.');
        setMessageType('info');
    } catch (error: any) {
        console.error('Pallet scan error', error);
        setMessage('System error while scanning pallet.');
      setMessageType('error');
      }
    }
  };

  const handleDone = () => {
    if (scannedBales > 0) {
      Alert.alert(
        'Reception Complete',
        `You have successfully received ${scannedBales} ${scannedBales === 1 ? 'product' : 'products'} in this session.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
    router.back();
    }
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    // 1) Immediately hide the scanner to provide instant feedback
    setScannerVisible(false);
    
    // 2) Defer the data processing until the next tick so the modal can start closing immediately
    setTimeout(() => {
      if (scannerTarget === 'qr' || (scannerTarget === 'product' && isPackedProduct && scannedCode.trim().startsWith('{'))) {
        const qrData = parseQrCode(scannedCode);
        if (qrData) {
          setQrCode(scannedCode);
          if (qrData.barcode) setBarcode(qrData.barcode);
          if (qrData.operation_no) setOperationNo(qrData.operation_no);
          if (qrData.crop_year) setCropYear(qrData.crop_year);
          if (qrData.tobacco_type) setTobaccoType(qrData.tobacco_type);
          if (qrData.manufacture_date) setManufactureDate(qrData.manufacture_date);
          if (qrData.product_type) setProductType(qrData.product_type);
          if (qrData.run_case_no) setRunCaseNo(qrData.run_case_no);
          if (qrData.package_no) setPackageNo(qrData.package_no);
          if (qrData.grade_name) setGradeName(qrData.grade_name);
          if (qrData.gross) setGross(qrData.gross);
          if (qrData.tare) setTare(qrData.tare);
          if (qrData.mass) {
            setMass(qrData.mass);
            setReceivedMass(qrData.mass);
          }
          
          setMessage('QR code data processed and fields auto-populated.');
          setMessageType('success');
          return;
        }
      }
      
      if (scannerTarget === 'product') {
        setBarcode(scannedCode);
        // For packed products, don't clear mass as it might have been set by QR scan
        if (!isPackedProduct) {
          setReceivedMass('');
        }
      } else if (scannerTarget === 'logistics') {
        setLogisticsBarcode(scannedCode);
      }
    }, 0);
  };

  const messageBg =
    messageType === 'success' ? 'bg-green-100' : messageType === 'error' ? 'bg-red-100' : 'bg-yellow-100';
  const messageText =
    messageType === 'success' ? 'text-green-800' : messageType === 'error' ? 'text-red-800' : 'text-yellow-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Scan Receive Product', headerShown: true }} />
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title={scannerTarget === 'product' ? 'Scan Product Barcode' : scannerTarget === 'logistics' ? 'Scan Logistics Barcode' : 'Scan QR Code'}
        />
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View className="flex-1">
      <ScrollView
            className="flex-1 p-5"
            contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 400 : 16 }}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
      >
        {/* Header info card – mirrors Odoo wizard alert */}
        <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
          <Text className="text-lg font-bold text-blue-900 mb-2">Complete Receipt</Text>
          <Text className="text-base text-blue-900">
            <Text className="font-semibold">Warehouse: </Text>
            {warehouseLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Location: </Text>
            {locationLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Product: </Text>
            {productLabel}
          </Text>
          <Text className="text-base text-blue-900 mt-1">
            <Text className="font-semibold">Scanned: </Text>
            {scannedBales} products
          </Text>
        </View>

        {/* Receiving mode – radio style toggle */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-2">Receiving Mode</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
                receivingMode === 'by_bale' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
              }`}
              onPress={() => setReceivingMode('by_bale')}
            >
              <View className="mr-2">
                <View
                  className={`w-4 h-4 rounded-full border-2 ${
                    receivingMode === 'by_bale' ? 'border-blue-600' : 'border-gray-400'
                  } items-center justify-center`}
                >
                  {receivingMode === 'by_bale' && (
                    <View className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Scan Individual Products</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
                receivingMode === 'by_pallet' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
              }`}
              onPress={() => setReceivingMode('by_pallet')}
            >
              <View className="mr-2">
                <View
                  className={`w-4 h-4 rounded-full border-2 ${
                    receivingMode === 'by_pallet' ? 'border-blue-600' : 'border-gray-400'
                  } items-center justify-center`}
                >
                  {receivingMode === 'by_pallet' && (
                    <View className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Scan by Racks</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barcode + optional fields */}
        <View className="mb-4">
          <Text className="text-gray-800 font-semibold mb-1">Barcode</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Scan or enter barcode here..."
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              value={barcode}
              onChangeText={setBarcode}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setScannerTarget('product');
                setScannerVisible(true);
              }}
              className="p-3 ml-2 bg-gray-200 rounded-lg"
            >
              <Camera size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {receivingMode === 'by_bale' && (
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Logistics Barcode</Text>
            <View className="flex-row items-center">
            <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Optional logistics barcode..."
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                value={logisticsBarcode}
                onChangeText={setLogisticsBarcode}
              />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScannerTarget('logistics');
                  setScannerVisible(true);
                }}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {receivingMode === 'by_bale' && (
          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Weight</Text>
            <TextInput
              ref={massInputRef}
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder={params.defaultWeight || "0.0"}
              placeholderTextColor="#9CA3AF"
              style={{ color: '#111827' }}
              keyboardType="numeric"
              value={receivedMass}
              onChangeText={setReceivedMass}
            />
          </View>
        )}

        {isPackedProduct && receivingMode === 'by_bale' && (
          <View className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-[#65435C]">Packed Product Details</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScannerTarget('qr');
                  setScannerVisible(true);
                }}
                className="flex-row items-center bg-[#65435C]/10 px-3 py-1.5 rounded-lg border border-[#65435C]/20"
              >
                <Camera size={18} color="#65435C" />
                <Text className="ml-2 text-[#65435C] font-semibold text-xs">Scan QR Data</Text>
              </TouchableOpacity>
            </View>
            
            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Run No</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={operationNo}
                  onChangeText={setOperationNo}
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Crop Year</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={cropYear}
                  onChangeText={setCropYear}
                />
              </View>
            </View>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Tobacco Type</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={tobaccoType}
                  onChangeText={setTobaccoType}
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Grade</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={gradeName}
                  onChangeText={setGradeName}
                  placeholder="Scan QR or enter..."
                />
              </View>
            </View>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Gross</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={gross}
                  onChangeText={setGross}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Tare</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={tare}
                  onChangeText={setTare}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Net Mass</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={mass}
                  onChangeText={setMass}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Case No</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={runCaseNo}
                  onChangeText={setRunCaseNo}
                />
              </View>
            </View>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Package No</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={packageNo}
                  onChangeText={setPackageNo}
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Count (CNT)</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={cnt}
                  onChangeText={setCnt}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Manufacture Date</Text>
                <Text className="text-gray-800 text-xs mt-2">{manufactureDate || 'N/A'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs mb-1">Product Type</Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded p-2 text-sm"
                  value={productType}
                  onChangeText={setProductType}
                />
              </View>
            </View>
          </View>
        )}

        {/* Message area */}
        {message ? (
          <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
            <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
          </View>
        ) : null}

        {/* Footer buttons – inside ScrollView */}
        <View className="mt-2 flex-row gap-3">
          <TouchableOpacity
            onPress={() => handleScan()}
            className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">
              {receivingMode === 'by_pallet' ? 'Receive Pallet' : 'Save Product'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row gap-3">
          <TouchableOpacity
            onPress={handleDone}
            className="flex-1 bg-green-600 p-3 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-semibold">Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-1 bg-gray-200 p-3 rounded-lg items-center justify-center"
          >
            <Text className="text-gray-800 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </KeyboardAvoidingView>
    </>
  );
};

export default WarehouseBaleScanScreen;


