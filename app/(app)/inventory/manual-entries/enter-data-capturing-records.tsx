import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { Stack } from 'expo-router';
import { powersync } from '@/powersync/system';
import { Camera } from 'lucide-react-native';
import BarcodeScanner from '../../../../components/BarcodeScanner';

type MessageType = 'info' | 'success' | 'error';
type Grade = { id: number; name: string };
type Product = { id: number; name: string };

const EnterDataCapturingScreen = () => {
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeSearch, setGradeSearch] = useState('');
  const [mass, setMass] = useState('');
  const [price, setPrice] = useState('');
  const [operationNo, setOperationNo] = useState('');
  const [tobaccoType, setTobaccoType] = useState('');
  const [pickingsWeight, setPickingsWeight] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('Scan or enter a barcode to begin data capture.');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [recordsCaptured, setRecordsCaptured] = useState(0);
  const [barcodeExists, setBarcodeExists] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load products (default to green product)
        const productRows = await powersync.getAll<Product>(
          `SELECT id, name FROM warehouse_product ORDER BY name`
        );
        setProducts(productRows || []);
        const greenProduct =
          productRows?.find((p) => p.name?.toLowerCase() === 'green product') || productRows?.[0];
        if (greenProduct) {
          setProductId(greenProduct.id);
        }

        // Load grades
        const gradeRows = await powersync.getAll<Grade>(
          `SELECT id, name FROM warehouse_bale_grade ORDER BY name`
        );
        setGrades(gradeRows || []);
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // Check if barcode exists when it changes
    const checkBarcode = async () => {
      if (barcode) {
        try {
          const existing = await powersync.getOptional<{ id: string }>(
            `SELECT id FROM warehouse_data_capturing WHERE barcode = ?`,
            [barcode]
          );
          if (existing) {
            setBarcodeExists(true);
            setMessage('This barcode was already captured!');
            setMessageType('info');
          } else {
            setBarcodeExists(false);
            setMessage('This barcode is new. You can proceed with data entry.');
            setMessageType('info');
          }
        } catch (err) {
          console.error('Failed to check barcode', err);
        }
      } else {
        setBarcodeExists(false);
        setMessage('Scan or enter a barcode to begin data capture.');
        setMessageType('info');
      }
    };
    checkBarcode();
  }, [barcode]);

  useEffect(() => {
    // Count records captured
    const countRecords = async () => {
      try {
        const result = await powersync.getOptional<{ count: number }>(
          `SELECT COUNT(*) as count FROM warehouse_data_capturing`
        );
        setRecordsCaptured(result?.count ?? 0);
      } catch (err) {
        console.error('Failed to count records', err);
      }
    };
    countRecords();
  }, []);

  const handleSave = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const code = overrideBarcode ?? barcode;
    if (!code) {
      setMessage('Barcode is required!');
      setMessageType('error');
      return;
    }

    try {
      const now = new Date().toISOString();

      // Check if record already exists
      const existing = await powersync.getOptional<{ id: string }>(
        `SELECT id FROM warehouse_data_capturing WHERE barcode = ?`,
        [code]
      );

      if (existing) {
        // Update existing record
        const updateVals: any = { write_date: now };
        if (mass) updateVals.mass = parseFloat(mass);
        if (price) updateVals.price = parseFloat(price);
        if (gradeId) updateVals.grade = gradeId;
        if (operationNo) updateVals.operation_no = operationNo;
        if (tobaccoType) updateVals.tobacco_type = tobaccoType;
        if (pickingsWeight) updateVals.pickings_weight = parseFloat(pickingsWeight);
        if (amount) updateVals.amount = parseFloat(amount);
        if (productId) updateVals.product_id = productId;

        // Check if there are any changes
        const hasChanges = Object.keys(updateVals).length > 1; // More than just write_date

        if (hasChanges) {
          const setClause = Object.keys(updateVals)
            .map((key) => `${key} = ?`)
            .join(', ');
          const values = Object.values(updateVals);
          values.push(existing.id);

          await powersync.execute(
            `UPDATE warehouse_data_capturing SET ${setClause} WHERE id = ?`,
            values
          );

          setMessage('Record updated successfully! Scan next barcode to continue.');
          setMessageType('success');
        } else {
          setMessage(`No changes detected for barcode ${code}.`);
          setMessageType('info');
        }
      } else {
        // Create new record
        // Find existing bale by barcode
        const existingBale = await powersync.getOptional<{ id: number }>(
          `SELECT id FROM warehouse_shipped_bale WHERE barcode = ? LIMIT 1`,
          [code]
        );

        await powersync.execute(
          `INSERT INTO warehouse_data_capturing (
            id, barcode, product_id, grade, mass, price, operation_no, 
            tobacco_type, pickings_weight, amount, existing_bale_id, create_date, write_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `temp_${Date.now()}_${Math.random()}`,
            code,
            productId || null,
            gradeId || null,
            mass ? parseFloat(mass) : null,
            price ? parseFloat(price) : null,
            operationNo || null,
            tobaccoType || null,
            pickingsWeight ? parseFloat(pickingsWeight) : null,
            amount ? parseFloat(amount) : null,
            existingBale?.id || null,
            now,
            now,
          ]
        );

        setMessage('Record saved successfully! Scan next barcode to continue.');
        setMessageType('success');
      }

      // Increment counter
      const countResult = await powersync.getOptional<{ count: number }>(
        `SELECT COUNT(*) as count FROM warehouse_data_capturing`
      );
      setRecordsCaptured(countResult?.count ?? recordsCaptured + 1);

      // Clear inputs for next entry (keep product)
      setBarcode('');
      setGradeId(null);
      setGradeSearch('');
      setMass('');
      setPrice('');
      setOperationNo('');
      setTobaccoType('');
      setPickingsWeight('');
      setAmount('');
      setBarcodeExists(false);
    } catch (err: any) {
      console.error('Data capturing save error', err);
      setMessage(`Error saving record: ${err?.message || 'Unknown error'}`);
      setMessageType('error');
    }
  };

  const filteredGrades = grades.filter((g) =>
    g.name.toLowerCase().includes(gradeSearch.toLowerCase())
  );

  const messageBg =
    messageType === 'success'
      ? 'bg-green-100'
      : messageType === 'error'
      ? 'bg-red-100'
      : 'bg-blue-100';
  const messageText =
    messageType === 'success'
      ? 'text-green-800'
      : messageType === 'error'
      ? 'text-red-800'
      : 'text-blue-800';

  return (
    <>
      <Stack.Screen options={{ title: 'Enter Data Capturing Records', headerShown: true }} />

      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <BarcodeScanner
          onBarcodeScanned={(code) => {
            // 1) Hide instantly
            setScannerVisible(false);
            
            // 2) Defer processing
            setTimeout(() => {
            setBarcode(code);
              handleSave(code);
            }, 0);
          }}
          onClose={() => setScannerVisible(false)}
          scanType="bale"
          title="Scan Barcode"
        />
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          className="flex-1 p-5"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="p-4 bg-blue-100 rounded-lg border border-blue-300 mb-4">
            <Text className="text-lg font-bold text-blue-900 mb-2">Data Capturing</Text>
            <Text className="text-base text-blue-900">
              Records Captured: {recordsCaptured}
            </Text>
            {barcodeExists && (
              <Text className="text-base text-orange-800 mt-1 font-semibold">
                This barcode was already captured!
              </Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Barcode *</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                placeholder="Enter or scan barcode..."
                value={barcode}
                onChangeText={setBarcode}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => handleSave()}
              />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setScannerVisible(true);
                }}
                className="p-3 ml-2 bg-gray-200 rounded-lg"
              >
                <Camera size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Product (optional)</Text>
            <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
              {products.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  className={`p-3 border-b border-gray-200 ${productId === p.id ? 'bg-blue-100' : 'bg-white'}`}
                  onPress={() => setProductId(p.id)}
                >
                  <Text className="text-base text-gray-900">{p.name}</Text>
                </TouchableOpacity>
              ))}
              {products.length === 0 && (
                <Text className="text-center text-gray-500 py-3">No products synced</Text>
              )}
            </ScrollView>
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Grade (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base mb-2"
              placeholder="Search grade..."
              value={gradeSearch}
              onChangeText={setGradeSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(gradeSearch || !gradeId) && (
              <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
                {filteredGrades.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    className={`p-3 border-b border-gray-200 ${gradeId === g.id ? 'bg-blue-100' : 'bg-white'}`}
                    onPress={() => {
                      setGradeId(g.id);
                      setGradeSearch(g.name);
                    }}
                  >
                    <Text className="text-base text-gray-900">{g.name}</Text>
                  </TouchableOpacity>
                ))}
                {filteredGrades.length === 0 && (
                  <Text className="text-center text-gray-500 py-3">No grades found</Text>
                )}
              </ScrollView>
            )}
            {gradeId && !gradeSearch && (
              <View className="p-3 bg-blue-100 border border-blue-300 rounded-lg">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base text-gray-900">
                    {grades.find((g) => g.id === gradeId)?.name}
                  </Text>
                  <TouchableOpacity onPress={() => setGradeId(null)}>
                    <Text className="text-blue-600 font-semibold">Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Mass (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter mass..."
              value={mass}
              onChangeText={setMass}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Price (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter price..."
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Operation No (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter operation number..."
              value={operationNo}
              onChangeText={setOperationNo}
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Tobacco Type (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter tobacco type..."
              value={tobaccoType}
              onChangeText={setTobaccoType}
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Pickings Weight (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter pickings weight..."
              value={pickingsWeight}
              onChangeText={setPickingsWeight}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-800 font-semibold mb-1">Amount (optional)</Text>
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Enter amount..."
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>

          {message ? (
            <View className={`mb-4 p-3 rounded-lg ${messageBg}`}>
              <Text className={`text-base font-semibold ${messageText}`}>{message}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => handleSave()}
            className="bg-[#65435C] p-4 rounded-lg items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">Save Record</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default EnterDataCapturingScreen;

