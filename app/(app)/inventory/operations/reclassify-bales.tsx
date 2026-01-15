import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Camera, Keyboard as KeyboardIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
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

const ReclassifyBaleScanScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gradeId?: string;
    gradeName?: string;
  }>();

  const [barcode, setBarcode] = useState('');
  const [grades, setGrades] = useState<{ id: string; name?: string }[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<{ id: string; name?: string } | null>(null);
  const [gradeSearchText, setGradeSearchText] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [reclassifiedBales, setReclassifiedBales] = useState(0);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [currentBaleId, setCurrentBaleId] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [showManualActions, setShowManualActions] = useState(false);

  const effectiveGradeId = selectedGrade?.id || params.gradeId;
  const gradeName = selectedGrade?.name || params.gradeName || 'Unknown';

  // Load initial reclassified bale count
  // Load grade list
  useEffect(() => {
    let cancelled = false;
    const loadGrades = async () => {
      try {
        const rows = (await powersync.getAll<any>('SELECT id, name FROM warehouse_bale_grade ORDER BY name')) || [];
        if (!cancelled) {
          setGrades(rows);
          // Preselect grade if passed via params
          if (!selectedGrade && params.gradeId) {
            const found = rows.find((g: any) => String(g.id) === String(params.gradeId));
            if (found) {
              setSelectedGrade({ id: String(found.id), name: found.name });
              setGradeSearchText(found.name || String(found.id));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load grades:', error);
      }
    };
    loadGrades();
    return () => {
      cancelled = true;
    };
  }, [params.gradeId, selectedGrade]);

  // Load reclassified count for the current grade
  useEffect(() => {
    const loadReclassifiedCount = async () => {
      if (effectiveGradeId) {
        try {
          const countResult = await powersync.getOptional<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM warehouse_shipped_bale 
             WHERE grade = ? 
               AND operation_type = 'reclassified'`,
            [Number(effectiveGradeId)]
          );
          setReclassifiedBales(countResult?.count || 0);
        } catch (error) {
          console.error('Failed to load reclassified bale count:', error);
        }
      } else {
        setReclassifiedBales(0);
      }
    };
    loadReclassifiedCount();
  }, [effectiveGradeId]);

  const handleScan = async (overrideBarcode?: string) => {
    Keyboard.dismiss();
    const effectiveBarcode = overrideBarcode ?? barcode;

    if (!effectiveGradeId) {
      setMessage('Please select the new grade before reclassifying.');
      setMessageType('error');
      return;
    }

    if (!effectiveBarcode) {
      setMessage('Please scan or enter bale barcode.');
      setMessageType('error');
      return;
    }

    setLastScannedBarcode(effectiveBarcode);
    setMessage('');
    setMessageType('info');

    try {
      // 1) Find the bale - must exist and be received
      const shippedBale = await powersync.getOptional<any>(
        `SELECT id, received, grade, pallet_id, barcode
         FROM warehouse_shipped_bale
         WHERE barcode = ?
           AND received = 1
         LIMIT 1`,
        [effectiveBarcode]
      );

      if (!shippedBale) {
        setMessage(`❌ Bale '${effectiveBarcode}' not found or not received!`);
        setMessageType('error');
        setBarcode('');
        setCurrentBaleId(null);
        return;
      }

      // Set current bale
      setCurrentBaleId(shippedBale.id);

      // 2) Check if bale is on a pallet
      if (shippedBale.pallet_id) {
        const pallet = await powersync.getOptional<any>(
          `SELECT barcode FROM warehouse_pallet WHERE id = ?`,
          [shippedBale.pallet_id]
        );
        const palletName = pallet?.barcode || 'Unknown';
        setMessage(`❌ Bale '${effectiveBarcode}' is on pallet '${palletName}'. Please remove it from the pallet before reclassifying.`);
        setMessageType('error');
        setBarcode('');
        setCurrentBaleId(null);
        return;
      }

      // 3) Check if bale already has the target grade
      if (shippedBale.grade && Number(shippedBale.grade) === Number(effectiveGradeId)) {
        setMessage(`❌ Bale '${effectiveBarcode}' already has grade '${gradeName}'. Ready for next scan...`);
        setMessageType('error');
        setBarcode('');
        setCurrentBaleId(null);
        return;
      }

      // 4) Get original grade name for message
      const originalGrade = shippedBale.grade
        ? await powersync.getOptional<any>(
            `SELECT name FROM warehouse_bale_grade WHERE id = ?`,
            [shippedBale.grade]
          )
        : null;
      const originalGradeName = originalGrade?.name || 'No Grade';

      // 5) Update the bale with new grade and operation_type
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE warehouse_shipped_bale 
         SET grade = ?,
             operation_type = 'reclassified',
             write_date = ?
         WHERE id = ?`,
        [Number(effectiveGradeId), now, shippedBale.id]
      );

      // 6) Update counters and reset for next scan
      setReclassifiedBales((prev) => prev + 1);
      setMessage(`✅ Bale '${effectiveBarcode}' reclassified from '${originalGradeName}' to '${gradeName}'! Ready for next scan...`);
      setMessageType('success');
      setBarcode('');
      setCurrentBaleId(null);

    } catch (error: any) {
      console.error('Reclassify bale error:', error);
      const msg = error?.message || 'System error while reclassifying. Please try again.';
      setMessage(`❌ ${msg}`);
      setMessageType('error');
      setBarcode('');
      setCurrentBaleId(null);
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setShowManualActions(false);
    
    // 1) Auto-process the scan and keep camera open
    setTimeout(() => {
    handleScan(scannedBarcode);
    }, 0);
  };

  const handleNextScan = () => {
    setBarcode('');
    setMessage('Scan a bale barcode to reclassify.');
    setMessageType('info');
    setCurrentBaleId(null);
  };

  const getMessageStyle = () => {
    switch (messageType) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: ` Bale Reclassification`, 
          headerShown: true 
        }} 
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          className="flex-1 p-5" 
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header card */}
          <View className="p-4 bg-[#65435C]/10 rounded-lg border border-[#65435C]/20 mb-4">
            <Text className="text-lg font-bold text-[#65435C] mb-2">
              Reclassify Bales
            </Text>
            <Text className="text-sm text-gray-600">
              Selected Grade: <Text className="font-bold text-[#65435C]">{gradeName}</Text>
            </Text>
          </View>

          {/* Message card */}
          {message && (
            <View className={`p-4 rounded-lg border mb-4 ${getMessageStyle()}`}>
              <Text className="text-base">{message}</Text>
            </View>
          )}

          {/* Barcode input card */}
          <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <Text className="font-semibold text-gray-700 mb-2">Bale Barcode</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-gray-50"
                placeholder="Scan or enter barcode..."
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={() => handleScan()}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View className="flex-row">
              <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setScannerVisible(true);
                    setShowManualActions(false);
                  }}
                className="bg-[#65435C] p-3 rounded-lg justify-center items-center"
                  style={{ marginRight: 8 }}
              >
                <Camera size={24} color="white" />
              </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setScannerVisible(false);
                    setShowManualActions(true);
                  }}
                  className="bg-gray-200 p-3 rounded-lg justify-center items-center"
                >
                  <KeyboardIcon size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-3 mb-4">
            {showManualActions && (
            <TouchableOpacity
              onPress={() => handleScan()}
              className="flex-1 bg-[#65435C] p-4 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">Reclassify Bale</Text>
            </TouchableOpacity>
            )}
           
          </View>

          {/* Done + Next side by side when not showing manual actions */}
          {!showManualActions && (
            <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Reclassification Complete',
                `You reclassified ${reclassifiedBales} bale${reclassifiedBales === 1 ? '' : 's'} to '${gradeName}'.`,
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            }}
                className="flex-1 bg-green-600 p-4 rounded-lg items-center justify-center"
              >
                <Text className="text-white font-semibold text-lg">Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextScan}
                className="flex-1 bg-gray-200 p-4 rounded-lg items-center justify-center"
          >
                <Text className="text-gray-800 font-semibold">Next Scan</Text>
          </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={isScannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View className="flex-1 bg-black">
          {/* Grade selection ABOVE everything */}
          <View className="p-4 pt-12 bg-[#65435C]">
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                className="flex-1 bg-white rounded-lg p-3 text-base"
                placeholder="Change Target Grade..."
                placeholderTextColor="#666"
                value={gradeSearchText}
                onChangeText={(text) => {
                  setGradeSearchText(text);
                  if (selectedGrade && text !== (selectedGrade.name || selectedGrade.id)) {
                    setSelectedGrade(null);
                  }
                }}
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                onPress={() => {
                  setGradeSearchText('');
                  setSelectedGrade(null);
                }}
                className="bg-white/20 rounded-full w-10 h-10 items-center justify-center"
              >
                <Text className="text-white text-lg font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {gradeSearchText.trim().length > 0 && !selectedGrade && (
              <View className="bg-white rounded-lg max-h-60 overflow-hidden shadow-xl z-50">
                <ScrollView keyboardShouldPersistTaps="handled">
                  {grades
                    .filter((g) =>
                      (g.name || g.id)
                        ?.toString()
                        .toLowerCase()
                        .includes(gradeSearchText.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((g) => (
                      <TouchableOpacity
                        key={g.id}
                        className="p-4 border-b border-gray-100"
                        onPress={() => {
                          setSelectedGrade({ id: String(g.id), name: g.name });
                          setGradeSearchText(g.name || String(g.id));
                          Keyboard.dismiss();
                        }}
                      >
                        <Text className="text-base text-gray-900 font-semibold">{g.name || g.id}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Camera Frame - Moved to the very top (below grade selection) */}
          <View style={{ height: 450 }}>
            <BarcodeScanner
              onBarcodeScanned={handleBarcodeScanned}
              onClose={() => setScannerVisible(false)}
              stayOnCamera={true}
              scanStatus={messageType === 'success' ? 'success' : messageType === 'error' ? 'error' : 'idle'}
            />
          </View>

         

          {/* Error/Success Message Section - Now at the bottom */}
          <View className="bg-black px-4 py-3">
            {message ? (
              <View className={`p-3 rounded-lg ${
                messageType === 'success' ? 'bg-green-500/20' : 
                messageType === 'error' ? 'bg-red-500/20' : 
                'bg-blue-500/20'
              }`}>
                <Text className={`text-base font-bold text-center ${
                  messageType === 'success' ? 'text-green-300' : 
                  messageType === 'error' ? 'text-red-300' : 
                  'text-blue-200'
                }`}>
                  {message}
                </Text>
              </View>
            ) : (
              <View className="h-12" />
            )}
          </View>

          {/* Bottom section with Finish button */}
          <View className="bg-black items-center justify-center p-6">
            <TouchableOpacity 
              onPress={() => setScannerVisible(false)}
              className="bg-gray-800 px-8 py-3 rounded-full border border-white/10"
            >
              <Text className="text-white font-semibold">Finish Scanning</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ReclassifyBaleScanScreen;

