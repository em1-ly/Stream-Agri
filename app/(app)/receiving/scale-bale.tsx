import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import React from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { powersync } from '@/powersync/setup';
import { BaleRecord, GrowerDeliveryNoteRecord } from '@/powersync/Schema';
import { SuccessToast } from '@/components/SuccessToast';
import { Picker } from '@react-native-picker/picker';
import { useNetwork } from '@/NetworkContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useSession } from '@/authContext';
import { ChevronLeft } from 'lucide-react-native';

// Safe storage wrapper: same as in sequencing-scanner
let RNAsync: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNAsync = require('@react-native-async-storage/async-storage').default;
} catch {}
const __memStore: Record<string, string> = {};
const SafeStorage = {
  async getItem(key: string) {
    try {
      if (RNAsync && typeof RNAsync.getItem === 'function') {
        return await RNAsync.getItem(key);
      }
    } catch {}
    return __memStore[key] ?? null;
  },
  async setItem(key: string, value: string) {
    try {
      if (RNAsync && typeof RNAsync.setItem === 'function') {
        return await RNAsync.setItem(key, value);
      }
    } catch {}
    __memStore[key] = value;
  }
};

const FormInput = ({ label, value, onChangeText, placeholder, editable = true }: { label: string; value: string; onChangeText: (text: string) => void; placeholder: string; editable?: boolean }) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
      <TextInput
      className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{ color: '#111827' }}
      editable={editable}
    />
  </View>
);

const FormPicker = ({ label, value, onValueChange, items, placeholder }: { 
  label: string; 
  value: string; 
  onValueChange: (value: string) => void; 
  items: Array<{label: string; value: string}>; 
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

const STORAGE_KEY = 'receiving:sequencingFormState';

const ScaleBaleScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isConnected } = useNetwork();
  const { session } = useSession();
  const navigation = useNavigation();
  
  // Original state variables
  const [lay, setLay] = useState('1');
  const [row, setRow] = useState('');
  const [rowMax, setRowMax] = useState<string>('');
  const [scaleBarcode, setScaleBarcode] = useState('');
  const [sellingPointId, setSellingPointId] = useState<string | null>(null);
  const [floorSaleId, setFloorSaleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [lastScanSuccess, setLastScanSuccess] = useState(false);
  const [growerNumber, setGrowerNumber] = useState('');
  const [growerName, setGrowerName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [documentNumberDisplay, setDocumentNumberDisplay] = useState('');
  const [totalScanned, setTotalScanned] = useState(0);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [rowCapacity, setRowCapacity] = useState(5);
  const [currentRowBales, setCurrentRowBales] = useState(0);
  
  // Enhanced state variables
  const [scannedBales, setScannedBales] = useState<Array<{
    barcode: string;
    gdInfo: { document_number?: string; grower_number?: string; grower_name?: string; number_of_bales?: number; number_of_bales_delivered?: number; lot_number?: string | number; group_number?: string | number };
    timestamp: string;
  }>>([]);
  const [currentGdInfo, setCurrentGdInfo] = useState<{ document_number?: string; grower_number?: string; grower_name?: string; number_of_bales?: number; number_of_bales_delivered?: number; lot_number?: string | number; group_number?: string | number } | null>(null);
  const [pendingGdNotes, setPendingGdNotes] = useState<Array<{ document_number: string; grower_number: string; grower_name: string; scanned: number; expected: number; progress: string }>>([]);
  const [allPendingGdNotes, setAllPendingGdNotes] = useState<Array<{
    document_number: string;
    grower_number: string;
    grower_name: string;
    number_of_bales: number;
    number_of_bales_delivered: number;
    scanned_bales: number;
    remaining_bales: number;
    progress_percentage: number;
    status: 'pending' | 'in_progress' | 'completed';
    last_scan_date?: string;
  }>>([]);
  // Store ALL notes (including completed) for summary display
  const [allGdNotes, setAllGdNotes] = useState<Array<{
    document_number: string;
    grower_number: string;
    grower_name: string;
    number_of_bales: number;
    number_of_bales_delivered: number;
    scanned_bales: number;
    remaining_bales: number;
    progress_percentage: number;
    status: 'pending' | 'in_progress' | 'completed';
    last_scan_date?: string;
  }>>([]);
  const [autoProcessTimeout, setAutoProcessTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [previousGdNotesStatus, setPreviousGdNotesStatus] = useState<Map<string, 'pending' | 'in_progress' | 'completed'>>(new Map());
  const [completedDocuments, setCompletedDocuments] = useState<Set<string>>(new Set());
  // Lay options for the picker
  const layOptions = [
    { label: 'Lay 1', value: '1' },
    { label: 'Lay 2', value: '2' },
    { label: 'Lay 3', value: '3' },
    { label: 'Lay 4', value: '4' },
    { label: 'Lay 5', value: '5' },
    { label: 'Lay 6', value: '6' },
  ];


  // This watcher now directly counts the synced records.
  useEffect(() => {
    if (!documentNumberDisplay) {
      setTotalScanned(0);
      setTotalDelivered(0);
      return;
    }

    let isCancelled = false;

    const updateCounts = async () => {
      try {
        // Get total expected count
        const deliveryNote = await powersync.get<GrowerDeliveryNoteRecord>(
          'SELECT id, number_of_bales_delivered FROM receiving_grower_delivery_note WHERE document_number = ?',
          [documentNumberDisplay]
        );
        const expected = deliveryNote?.number_of_bales_delivered || 0;
        if (!isCancelled) setTotalDelivered(expected);

        // Count all synced sequencing records for this delivery
        const result = await powersync.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id = ?',
          [deliveryNote?.id]
        );
        if (!isCancelled) setTotalScanned(result?.count || 0);

        console.log(`[Direct Count] Progress for ${documentNumberDisplay}: ${result?.count || 0}/${expected}`);
      } catch (e) {
        if (!String(e).includes('empty')) {
          console.warn(`[Direct Count] Error updating counts for ${documentNumberDisplay}`, e);
        }
      }
    };

    updateCounts();

    const watcher = powersync.watch(
      `SELECT * FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id IN (SELECT id FROM receiving_grower_delivery_note WHERE document_number = '${documentNumberDisplay}')`,
      [],
      { onResult: updateCounts }
    );

    return () => {
      isCancelled = true;
    };
  }, [documentNumberDisplay]);


  // Original actionScanBale function with enhanced error handling
  const actionScanBale = useCallback(async () => {
    // Store the barcode to clear it in finally block
    const barcodeToProcess = scaleBarcode;
    let docNum = '';
    let gdnId: number | null = null;
    
    if (!barcodeToProcess) {
      setResultMessage('Please enter a barcode');
      setIsError(true);
      return;
    }

    if (!row.trim()) {
      setResultMessage('❌ Please enter a row number');
      setIsError(true);
      return;
    }

    // Pre-validation: Validate row is a valid integer
    const rowNumber = parseInt(row.trim(), 10);
    if (isNaN(rowNumber) || rowNumber <= 0) {
      setResultMessage('❌ Row number must be a valid positive integer');
      setIsError(true);
      return;
    }

    // Pre-validation: Validate lay is provided and valid
    if (!lay || !lay.trim()) {
      setResultMessage('❌ Please select a lay number');
      setIsError(true);
      return;
    }

    const layNumber = parseInt(lay.trim(), 10);
    if (isNaN(layNumber) || layNumber <= 0) {
      setResultMessage('❌ Lay number must be a valid positive integer');
      setIsError(true);
      return;
          }

    // Pre-validation: Validate selling_point_id and floor_sale_id are provided
    if (!sellingPointId || !sellingPointId.trim()) {
      setResultMessage('❌ Selling point is required for sequencing');
      setIsError(true);
      return;
      }

    if (!floorSaleId || !floorSaleId.trim()) {
      setResultMessage('❌ Floor sale is required for sequencing');
      setIsError(true);
      return;
    }

    // Pre-validation: Check that floor sale has a sale_point_id configured
    try {
      const floorSaleIdNum = parseInt(floorSaleId, 10);
      if (!isNaN(floorSaleIdNum)) {
        const floorSale = await powersync.get<any>(
          `SELECT sale_point_id FROM floor_maintenance_floor_sale WHERE id = ? LIMIT 1`,
          [floorSaleIdNum]
        );
        
        if (!floorSale?.sale_point_id) {
          setResultMessage('❌ Error in selecting correct location for sale. This location does not have a sell point.');
      setIsError(true);
      return;
        }
      }
    } catch (e) {
      console.warn('⚠️ Error checking floor sale configuration:', e);
      // Continue - server will validate
    }

    // Do not block UI with a spinner; respond instantly
    setResultMessage('');
    setIsError(false);

    try {
      // OFFLINE: Update UI state and local counters without server calls
      setLastScanSuccess(true);

      // Use the stored barcode to fetch local info before clearing input
      const scanned = barcodeToProcess;

      // Local: resolve bale + progress from PowerSync
      try {
        console.log('🔍 Looking up bale locally for scanned barcode:', scanned);
        const bale = await powersync.get<any>(
          `SELECT 
              b.document_number,
              b.grower_number,
              b.lot_number,
              b.group_number,
              b.grower_delivery_note_id,
              b.state as bale_state,
              b.mass,
              b.source_mass
           FROM receiving_bale b
          WHERE b.scale_barcode = ? OR b.barcode = ?
          ORDER BY COALESCE(b.write_date, b.create_date) DESC
          LIMIT 1`,
          [scanned, scanned]
        );

        console.log('🔍 Local bale row:', bale);
        
        // Pre-validation 1: Check if bale exists
        if (!bale) {
          setResultMessage(`❌ Bale with barcode ${scanned} not found in local database.\n\nPlease ensure the bale has been added to a delivery note first.`);
          setIsError(true);
          setLastScanSuccess(false);
          setScaleBarcode('');
          return;
        }

        // Pre-validation 2b: Ensure bale has a positive recorded mass before sequencing
        const parseMassValue = (value: unknown): number => {
          if (value === null || value === undefined) return NaN;
          const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
          return Number.isNaN(numericValue) ? NaN : numericValue;
        };
        const recordedMass = parseMassValue(bale.mass);
        const fallbackMass = parseMassValue(bale.source_mass);
        const resolvedMassKg = Number.isFinite(recordedMass) ? recordedMass : fallbackMass;
        if (!Number.isFinite(resolvedMassKg) || resolvedMassKg <= 0) {
          setResultMessage(`❌ Scan Failed\n\nBale ${scanned} has zero recorded mass and cannot be sequenced. Please send it back to the scale to capture the weight.`);
          setIsError(true);
          setLastScanSuccess(false);
          setScaleBarcode('');
          return;
        }

        // Pre-validation 2: Check for bale errors (if state indicates an error)
        const baleState = (bale.bale_state || '').toLowerCase();
        if (baleState && ['error', 'failed', 'invalid', 'rejected'].includes(baleState)) {
          setResultMessage(`❌ Cannot sequence bale: Bale has an error state (${bale.bale_state}).\n\nPlease resolve the bale error before sequencing.`);
          setIsError(true);
          setLastScanSuccess(false);
          setScaleBarcode('');
          return;
        }

          setGrowerNumber(bale.grower_number || '');
          setLotNumber(bale.lot_number || '');
          setGroupNumber(bale.group_number || '');
          docNum = bale.document_number || '';
          gdnId = bale.grower_delivery_note_id || null;
        
        // Pre-validation 3: Require we have some linkage to a delivery before recording
        if (!docNum && !gdnId) {
          console.warn('⚠️ Skipping sequencing insert: missing document_number and grower_delivery_note_id');
          setResultMessage('❌ Could not resolve delivery for this bale.\n\nBale must be associated with a delivery note before sequencing.');
          setIsError(true);
          setLastScanSuccess(false);
          setScaleBarcode('');
          return;
        }

          if (!docNum && bale.grower_delivery_note_id) {
            try {
              const gdn = await powersync.get<any>(
              `SELECT document_number, state, selling_point_id, grower_name FROM receiving_grower_delivery_note WHERE id = ? LIMIT 1`,
                [bale.grower_delivery_note_id]
              );
              docNum = gdn?.document_number || '';
              if (gdn?.grower_name) {
                setGrowerName(gdn.grower_name);
              }
              console.log('🔗 Resolved document number via GDN id:', docNum);
            
            // Pre-validation 4: Check GDN state - must be 'laid' to allow sequencing
            const gdnState = (gdn?.state || '').toLowerCase();
            if (gdnState && gdnState !== 'laid') {
              setResultMessage(`❌ Cannot sequence bale: Delivery note ${docNum || gdnId} is in state "${gdn?.state || 'unknown'}" and must be "Laid" to allow sequencing.\n\nCurrent state: ${gdn?.state || 'unknown'}`);
              setIsError(true);
              setLastScanSuccess(false);
              setScaleBarcode('');
              return;
            }

            // Pre-validation 5: Check if delivery note has a selling point
            if (!gdn?.selling_point_id) {
              setResultMessage(`❌ Scan Failed\n\nThis delivery does not have a selling point.`);
              setIsError(true);
              setLastScanSuccess(false);
              setScaleBarcode('');
              return;
            }

            // Pre-validation 5b: Check that delivery selling point matches floor sale selling point
            if (gdn?.selling_point_id && sellingPointId && floorSaleId) {
              try {
                const floorSale = await powersync.get<any>(
                  `SELECT sale_point_id FROM floor_maintenance_floor_sale WHERE id = ? LIMIT 1`,
                  [parseInt(floorSaleId, 10)]
                );
                
                if (floorSale?.sale_point_id) {
                  const deliverySellingPointId = gdn.selling_point_id;
                  const floorSaleSellingPointId = floorSale.sale_point_id;
                  
                  if (deliverySellingPointId !== floorSaleSellingPointId) {
                    // Get selling point name for better error message
                    const sellingPoint = await powersync.get<any>(
                      `SELECT name FROM floor_maintenance_selling_point WHERE id = ? LIMIT 1`,
                      [deliverySellingPointId]
                    );
                    const sellingPointName = sellingPoint?.name || `Selling Point ${deliverySellingPointId}`;
                    
                    setResultMessage(`❌ Scan Failed\n\nThis delivery is for ${sellingPointName}. Please select the correct selling point.`);
                    setIsError(true);
                    setLastScanSuccess(false);
                    setScaleBarcode('');
                    return;
                  }
                } else {
                  setResultMessage(`❌ Scan Failed\n\nError in selecting correct location for sale. This location does not have a sell point.`);
                  setIsError(true);
                  setLastScanSuccess(false);
                  setScaleBarcode('');
                  return;
                }
              } catch (e) {
                console.warn('⚠️ Error checking floor sale selling point:', e);
                // Continue - server will validate
              }
            }
            } catch (e) {
              console.warn('⚠️ Failed to resolve document number via GDN id', e);
            }
        } else if (docNum) {
          // Pre-validation 4: Check GDN state when we have document_number - must be 'laid'
          try {
            const gdn = await powersync.get<any>(
              `SELECT state, selling_point_id, grower_name FROM receiving_grower_delivery_note WHERE document_number = ? LIMIT 1`,
              [docNum]
            );
            if (gdn?.grower_name) {
              setGrowerName(gdn.grower_name);
            }
            const gdnState = (gdn?.state || '').toLowerCase();
            if (gdnState && gdnState !== 'laid') {
              setResultMessage(`❌ Cannot sequence bale: Delivery note ${docNum} is in state "${gdn?.state || 'unknown'}" and must be "Laid" to allow sequencing.\n\nCurrent state: ${gdn?.state || 'unknown'}`);
              setIsError(true);
              setLastScanSuccess(false);
              setScaleBarcode('');
              return;
            }

            // Pre-validation 5: Check if delivery note has a selling point
            if (!gdn?.selling_point_id) {
              setResultMessage(`❌ Scan Failed\n\nThis delivery does not have a selling point.`);
              setIsError(true);
              setLastScanSuccess(false);
              setScaleBarcode('');
              return;
            }

            // Pre-validation 5b: Check that delivery selling point matches floor sale selling point
            if (gdn?.selling_point_id && sellingPointId && floorSaleId) {
              try {
                const floorSale = await powersync.get<any>(
                  `SELECT sale_point_id FROM floor_maintenance_floor_sale WHERE id = ? LIMIT 1`,
                  [parseInt(floorSaleId, 10)]
                );
                
                if (floorSale?.sale_point_id) {
                  const deliverySellingPointId = gdn.selling_point_id;
                  const floorSaleSellingPointId = floorSale.sale_point_id;
                  
                  if (deliverySellingPointId !== floorSaleSellingPointId) {
                    // Get selling point name for better error message
                    const sellingPoint = await powersync.get<any>(
                      `SELECT name FROM floor_maintenance_selling_point WHERE id = ? LIMIT 1`,
                      [deliverySellingPointId]
                    );
                    const sellingPointName = sellingPoint?.name || `Selling Point ${deliverySellingPointId}`;
                    
                    setResultMessage(`❌ Scan Failed\n\nThis delivery is for ${sellingPointName}. Please select the correct selling point.`);
                    setIsError(true);
                    setLastScanSuccess(false);
                    setScaleBarcode('');
                    return;
                  }
                } else {
                  setResultMessage(`❌ Scan Failed\n\nError in selecting correct location for sale. This location does not have a sell point.`);
                  setIsError(true);
                  setLastScanSuccess(false);
                  setScaleBarcode('');
                  return;
                }
              } catch (e) {
                console.warn('⚠️ Error checking floor sale selling point:', e);
                // Continue - server will validate
              }
            }
          } catch (e) {
            console.warn('⚠️ Failed to check GDN state', e);
          }
        }

          setDocumentNumberDisplay(docNum);
          console.log('🧭 Set documentNumberDisplay to:', docNum);

        // Pre-validation 6: Check if bale has already been sequenced
        try {
          const existingSequencing = await powersync.get<any>(
            `SELECT "row", lay, create_date
             FROM receiving_curverid_bale_sequencing_model 
             WHERE barcode = ?
             LIMIT 1`,
            [scanned]
          );
          
          if (existingSequencing) {
            const rowNum = existingSequencing.row;
            const layNum = existingSequencing.lay;
            const scanDate = existingSequencing.create_date || 'unknown date';
            setResultMessage(`❌ Scan Failed\n\nThis bale has already been sequenced in Row ${rowNum}, Lay ${layNum} on ${scanDate}.`);
              setIsError(true);
            setLastScanSuccess(false);
            setScaleBarcode('');
            return;
          }
        } catch (sequencingError: any) {
          // Table might not exist yet - treat as not sequenced
          if (sequencingError?.message?.includes('no such table') || sequencingError?.message?.includes('does not exist')) {
            console.log('⚠️ Sequencing table not found yet - treating bale as not sequenced');
          } else if (sequencingError?.message?.includes('empty') || sequencingError?.message?.includes('Result set')) {
            // No existing sequencing record - this is fine, continue
          } else {
            console.warn('⚠️ Error checking if bale already sequenced:', sequencingError);
            // Continue - server will validate
          }
        }

        // Pre-validation 7: Check if row/lay is full before allowing scan
        try {
          const rowNum = parseInt(row, 10);
          const layNum = lay ? parseInt(lay, 10) : null;
          const sellingPointIdNum = sellingPointId ? parseInt(sellingPointId, 10) : null;
          const floorSaleIdNum = floorSaleId ? parseInt(floorSaleId, 10) : null;

          if (!isNaN(rowNum) && layNum !== null && sellingPointIdNum !== null && floorSaleIdNum !== null) {
            // Count existing bales in this row/lay combination for today
            // Match backend logic: filter by selling_point_id, row, lay, and scan_date (today)
            let existingCount = 0;
            try {
              // Get today's date in YYYY-MM-DD format
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
              
              const countResult = await powersync.get<{ count: number }>(
                `SELECT COUNT(*) as count 
                 FROM receiving_curverid_bale_sequencing_model 
                 WHERE "row" = ? AND lay = ? AND selling_point_id = ? AND DATE(create_date) = ?`,
                [rowNum, layNum.toString(), sellingPointIdNum, todayStr]
              );
              existingCount = countResult?.count || 0;
            } catch (countError: any) {
              // Table might not exist yet - treat as 0 count
              if (countError?.message?.includes('no such table') || countError?.message?.includes('does not exist')) {
                console.log('⚠️ Sequencing table not found yet - treating row/lay as empty');
                existingCount = 0;
              } else {
                console.warn('⚠️ Error counting existing bales in row/lay:', countError);
                // Continue with validation - worst case we'll get server error
              }
            }

            // Check if adding this bale would exceed capacity
            const maxCapacity = rowCapacity || 5; // Default to 5 if not set
            if (existingCount >= maxCapacity) {
              setResultMessage(`❌ Scan Failed\n\nRow ${rowNum} Lay ${layNum} is full (${existingCount}/${maxCapacity} bales). Please select a different row or lay.`);
              setIsError(true);
              setLastScanSuccess(false);
              setScaleBarcode('');
              return;
            }
          }
        } catch (capacityError) {
          console.warn('⚠️ Error checking row/lay capacity:', capacityError);
          // Continue with validation - worst case we'll get server error
        }

        // Prevent duplicate scans for the same delivery and barcode
        let duplicateFound = false;
        try {
            let existingRows: any[] = [];
            try {
              // We check against delivery_note_id now
              existingRows = await powersync.getAll<any>(
              `SELECT id, "row" as row_number, lay, create_date, write_date
                 FROM receiving_curverid_bale_sequencing_model
                WHERE barcode = ? AND delivery_note_id = ?
                ORDER BY COALESCE(write_date, create_date) DESC
                LIMIT 1`,
              [scanned, gdnId]
              ) || [];
            } catch (tableError: any) {
              // Table might not exist yet if schema was just updated - treat as no duplicates
              if (tableError?.message?.includes('no such table') || tableError?.message?.includes('does not exist')) {
                console.log('⚠️ Sequencing table not found yet - treating as no duplicates (table will be created on next sync)');
                existingRows = [];
              } else {
                throw tableError; // Re-throw if it's a different error
              }
            }
            const alreadyExists = Array.isArray(existingRows) && existingRows.length > 0;
            if (alreadyExists) {
              duplicateFound = true;
              const ex = existingRows[0] || {};
              // Prefer ISO datetime fields and render a friendly local time
              let scannedAt: string | null = ex.create_date || ex.write_date || null;
              try {
                if (scannedAt) scannedAt = new Date(scannedAt).toLocaleString();
              } catch {}

              // Start with what we know from prior queries
              let docNumText: string | null = docNum || null;
              let lotNumText: string | number | null = bale?.lot_number ?? null;
              let groupNumText: string | number | null = bale?.group_number ?? null;

              // If any core fields missing, backfill from receiving_bale table by barcode
              if (!docNumText || !lotNumText || !groupNumText) {
                try {
                  const backfill = await powersync.get<any>(
                    `SELECT document_number, lot_number, group_number
                       FROM receiving_bale
                      WHERE scale_barcode = ? OR barcode = ?
                   ORDER BY COALESCE(write_date, create_date) DESC
                      LIMIT 1`,
                    [scanned, scanned]
                  );
                  if (backfill) {
                    if (!docNumText) docNumText = backfill.document_number || docNumText;
                    if (!lotNumText) lotNumText = backfill.lot_number ?? lotNumText;
                    if (!groupNumText) groupNumText = backfill.group_number ?? groupNumText;
                  }
                } catch {}
              }

              const lotText = (lotNumText != null && `${String(lotNumText)}`.trim() !== '' ? `Lot: ${lotNumText}` : null);
              const groupText = (groupNumText != null && `${String(groupNumText)}`.trim() !== '' ? `Group: ${groupNumText}` : null);
              const docText = (docNumText ? `Document: ${docNumText}` : null);
              const rowText = (ex?.row_number ? `Row: ${ex.row_number}` : null);
              const layText = (ex?.lay ? `Lay: ${ex.lay}` : null);
              const whenText = (scannedAt ? `Scanned at: ${scannedAt}` : null);
              const barcodeText = (ex?.barcode ? `Barcode: ${ex.barcode}` : `Barcode: ${scanned}`);

              const parts = [barcodeText, docText, lotText, groupText, rowText, layText, whenText].filter(Boolean);
              const details = parts.length ? parts.join(' | ') : `Barcode: ${scanned}`;

              setResultMessage(`This bale has already been scanned for this delivery.\n${details}`);
              setIsError(true);
              setLastScanSuccess(false);
            } else {
              // All pre-validations passed - safe to insert into local sequencing table
              // Note: The schema for this table is now different
              const nowIso = new Date().toISOString();
              const seqId = uuidv4();
              
              try {
              // The local insert includes mobile user info so we can filter pending GD notes correctly
              const currentUserId = (session as any)?.userId ?? (session as any)?.uid;
              const currentUserName = (session as any)?.name || '';
              
              await powersync.execute(
                `INSERT INTO receiving_curverid_bale_sequencing_model (
                   id, barcode, delivery_note_id, "row", lay, selling_point_id, floor_sale_id, create_date, write_date, create_uid, mobile_scanned_by_id, mobile_scanned_by_name
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  seqId,
                  scanned,
                  gdnId,
                  parseInt(row, 10) || null,
                  lay || null,
                  sellingPointId ? Number(sellingPointId) : null,
                  floorSaleId ? Number(floorSaleId) : null,
                  nowIso,
                  nowIso,
                  currentUserId != null ? Number(currentUserId) : null,
                  currentUserId != null ? Number(currentUserId) : null,
                  currentUserName || null
                ]
              );
                console.log('✅ Sequencing record inserted successfully');
              } catch (insertError: any) {
                // Check if table doesn't exist yet
                if (insertError?.message?.includes('no such table') || insertError?.message?.includes('does not exist')) {
                  console.warn('⚠️ Sequencing table not found yet - record will be inserted when table is created (restart app or wait for PowerSync schema update)');
                  // Don't show error to user - the record will be created when PowerSync creates the table
                  // PowerSync will handle the sync once the table exists
                } else {
                  console.error('❌ Failed to insert sequencing record:', insertError);
                  setResultMessage(`❌ Failed to save sequencing record: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`);
                  setIsError(true);
                  setLastScanSuccess(false);
                  setScaleBarcode('');
                  return;
                }
              }

              // Sequencing record will be synced to server via PowerSync Connector
              // The Connector handles this through unified_create with type 'bale_sequencing'
              // Odoo will automatically create ticket printing batch when delivery completes
              console.log('✅ Sequencing record saved locally - will sync to server via PowerSync');

              // Check for completion immediately after scan (Local check)
              // Use setTimeout to ensure the database transaction has committed
              setTimeout(async () => {
              try {
                if (docNum || gdnId) {
                  const deliveryStats = await powersync.get<any>(
                    `SELECT 
                       (SELECT COUNT(*) FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id = gdn.id) as scanned_count,
                       COALESCE(gdn.number_of_bales_delivered, gdn.number_of_bales, 0) as expected_count,
                       gdn.document_number
                     FROM receiving_grower_delivery_note gdn
                     WHERE ${docNum ? 'gdn.document_number = ?' : 'gdn.id = ?'}`,
                    [docNum || gdnId]
                  );

                  if (deliveryStats) {
                    const scanned = deliveryStats.scanned_count || 0;
                    const expected = deliveryStats.expected_count || 0;
                    const finalDocNum = deliveryStats.document_number || docNum || 'Unknown';

                      // Check if completion is reached (accounting for the record we just inserted)
                      // Add 1 to scanned count since we just inserted a record
                      const totalScanned = scanned + 1;

                      if (expected > 0 && totalScanned >= expected && !completedDocuments.has(finalDocNum)) {
                        console.log(`🎉 GD Note ${finalDocNum} completed by local scan! (${totalScanned}/${expected})`);
                        setCompletedDocuments(prev => new Set(prev).add(finalDocNum));
                      const message = `✅ GD Note ${finalDocNum} Completed!\n\nDelivery note completed and sent to ticket printing.`;
                      setSuccessMessage(message);
                      setShowSuccess(true);
                      
                      Alert.alert(
                        'Delivery Complete',
                          `Delivery note ${finalDocNum} completed and sent to ticket printing.`,
                        [{ text: 'OK' }]
                      );
                    }
                  }
                }
              } catch (completionError) {
                console.warn('⚠️ Failed to check completion status:', completionError);
              }
              }, 100); // Small delay to ensure database commit
            }
          } catch (e) {
            console.warn('⚠️ Duplicate check/insert failed', e);
          }

          if (duplicateFound) {
            // Do not progress counters or continue processing for duplicates
            setLastScanSuccess(false);
            setScaleBarcode('');
            return;
          }

          // The watcher useEffect will handle progress updates automatically
      } catch (e) {
        console.warn('⚠️ Local progress fetch failed', e);
        setResultMessage(`❌ Error processing bale lookup: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setIsError(true);
        setLastScanSuccess(false);
        setScaleBarcode('');
        return;
      }

      const newRowBales = currentRowBales + 1;
      setCurrentRowBales(newRowBales);

      if (newRowBales >= rowCapacity) {
        const currentRowNum = parseInt(row, 10) || 0;
        setRow((currentRowNum + 1).toString());
        setCurrentRowBales(0);
        console.log(`Row ${currentRowNum} is full! Moving to Row ${currentRowNum + 1}`);
      } else {
        console.log('Bale scanned (offline).');
      }

      setIsError(false);
      
      // Force refresh counts after successful scan (with small delay to ensure DB commit)
      setTimeout(async () => {
      try {
        if (docNum || gdnId) {
          // Trigger a manual count update
          const deliveryNote = await powersync.get<GrowerDeliveryNoteRecord>(
            'SELECT id, number_of_bales_delivered FROM receiving_grower_delivery_note WHERE document_number = ? OR id = ?',
            [docNum || '', gdnId || '']
          );
          if (deliveryNote) {
            const result = await powersync.get<{ count: number }>(
              'SELECT COUNT(*) as count FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id = ?',
              [deliveryNote.id]
            );
              const scannedCount = result?.count || 0;
              const expectedCount = deliveryNote.number_of_bales_delivered || 0;
              
              setTotalScanned(scannedCount);
              setTotalDelivered(expectedCount);
              
              // Also check for completion here as a backup (only if not already shown)
              if (expectedCount > 0 && scannedCount >= expectedCount) {
                const finalDocNum = docNum || 'Unknown';
                if (!completedDocuments.has(finalDocNum)) {
                  console.log(`🎉 GD Note ${finalDocNum} completed! (${scannedCount}/${expectedCount})`);
                  setCompletedDocuments(prev => new Set(prev).add(finalDocNum));
                  const message = `✅ GD Note ${finalDocNum} Completed!\n\nDelivery note completed and sent to ticket printing.`;
                  setSuccessMessage(message);
                  setShowSuccess(true);
                  
                  Alert.alert(
                    'Delivery Complete',
                    `Delivery note ${finalDocNum} completed and sent to ticket printing.`,
                    [{ text: 'OK' }]
                  );
                }
              }
          }
        }
      } catch (countError) {
        console.warn('⚠️ Failed to refresh counts:', countError);
      }
      }, 150); // Small delay to ensure database commit

      // Optionally refresh pending list (already local)
      try {
        await fetchAllPendingGdNotes();
      } catch {}

    } catch (error: any) {
      console.error('❌ Error processing scan:', error);
      setResultMessage(`❌ Error processing scan: ${error?.message || 'Unknown error'}`);
      setIsError(true);
      setLastScanSuccess(false);
    } finally {
      // Always clear the barcode to prevent it from getting stuck
      if (scaleBarcode === barcodeToProcess) {
        setScaleBarcode('');
      }
      // Reset processing state
      setIsProcessing(false);
    }
  }, [
    scaleBarcode,
    row,
    lay,
    sellingPointId,
    floorSaleId,
    currentRowBales,
    rowCapacity
  ]);

  const getGdExpected = (gdInfo: any) => {
    if (!gdInfo) return undefined;
    // Use number_of_bales_delivered as the expected count (total delivered from Odoo)
    return (typeof gdInfo.number_of_bales_delivered === 'number' && gdInfo.number_of_bales_delivered > 0)
        ? gdInfo.number_of_bales_delivered
        : undefined;
  };

  // Enhanced handleOpenScanner function that processes after scanning
  const handleOpenScanner = useCallback(() => {
    // Navigate on next frame to keep UI responsive
    const nav = () => router.replace({
      pathname: '/receiving/barcode-scanner',
      params: { 
        returnTo: 'scale-bale',
        row: row,
        lay: lay,
        selling_point_id: sellingPointId || '1',
        floor_sale_id: floorSaleId || '2'
      }
    });
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => nav());
    } else {
      setTimeout(nav, 0);
    }
  }, [router, row, lay, sellingPointId, floorSaleId]);

  // Fetch row capacity from Odoo API
  const fetchRowCapacity = useCallback(async () => {
    // OFFLINE: Use default or previously set capacity
    console.log('Using local row capacity:', rowCapacity);
  }, [rowCapacity]);

  const fetchCurrentLay = async (rowNumber: string) => {
    try {
      // Try to get the most recent lay info for this row
      const lay = await powersync.get<any>(
        `SELECT max_count, current_count, lay_number, date, is_active_lay
           FROM receiving_curverid_row_management
          WHERE row_number = ? AND date = date('now') AND is_active_lay = 1
         ORDER BY COALESCE(write_date, create_date) DESC LIMIT 1`,
        [rowNumber]
      );
      return lay;
    } catch {
      return null;
    }
  };

  // Check if all bales for a GD Note are scanned
  const checkGdNoteCompletion = (documentNumber: string, updatedScannedBales?: any[]) => {
    const balesToCheck = updatedScannedBales || scannedBales;
    const gdBales = balesToCheck.filter(bale => bale.gdInfo.document_number === documentNumber);
    const gdInfo = gdBales[0]?.gdInfo;
    if (!gdInfo) return false;
    
    const expected = getGdExpected(gdInfo);
    if (!expected) return false;
    
    return gdBales.length >= expected;
  };

  // Odoo automatically creates ticket printing batches when delivery completes

  // Fetch pending GD Notes scanned on this device (local sequencing), not global pending
  const fetchAllPendingGdNotes = async () => {
    const userId = (session as any)?.userId ?? (session as any)?.uid;
    if (!userId) {
      console.log('⚠️ Cannot fetch pending notes, user ID not found in session.');
      console.log('Session object:', JSON.stringify(session));
      setAllPendingGdNotes([]);
      return [];
    }
    
    try {
      console.log(`🔍 Fetching pending GD Notes for mobile user ID: ${userId}`);

      // 1) Gather document numbers where THIS mobile user has scanned bales.
      // We filter by mobile_scanned_by_id (the actual mobile employee who scanned) first,
      // with fallback to create_uid for legacy records that haven't been synced yet.
      // Odoo sets create_uid to the admin user after sync, but mobile_scanned_by_id contains the real mobile user.
      const userScannedDocs = await powersync.getAll<{ document_number: string }>(
        `SELECT DISTINCT gdn.document_number
         FROM receiving_curverid_bale_sequencing_model seq
         JOIN receiving_grower_delivery_note gdn ON gdn.id = seq.delivery_note_id
         WHERE (seq.mobile_scanned_by_id = ? OR (seq.mobile_scanned_by_id IS NULL AND CAST(seq.create_uid AS TEXT) = ?))`,
        [Number(userId), String(userId)]
      );
      
      console.log(`🔍 Found ${userScannedDocs.length} documents scanned by mobile user ${userId}`);
      
      const docNumbers = userScannedDocs.map(d => d.document_number).filter(Boolean);
      if (docNumbers.length === 0) {
        console.log('ℹ️ No active deliveries found for this mobile user.');
        setAllPendingGdNotes([]);
        setAllGdNotes([]);
        return [];
      }

      // 2) Gather all local scans for those specific document_numbers
      const placeholders = docNumbers.map(() => '?').join(',');
      const localScans = await powersync.getAll<any>(
      `SELECT
            gdn.document_number,
            COUNT(seq.id) AS scanned_bales,
            MAX(seq.write_date) AS last_scan_date
          FROM receiving_curverid_bale_sequencing_model seq
          JOIN receiving_grower_delivery_note gdn ON gdn.id = seq.delivery_note_id
        WHERE gdn.document_number IN (${placeholders})
        GROUP BY gdn.document_number`,
        docNumbers
      ) || [];


      if (!Array.isArray(localScans) || localScans.length === 0) {
        setAllPendingGdNotes([]);
        setAllGdNotes([]);
        return [];
      }

      // 3) Fetch expected counts for those document_numbers from GD Notes
      const gdNotes = await powersync.getAll<any>(
        `SELECT 
            g.document_number,
            g.grower_number,
            g.grower_name,
            g.number_of_bales,
            COALESCE(g.number_of_bales_delivered, g.number_of_bales, 0) AS number_of_bales_delivered,
            g.create_date,
            g.write_date
         FROM receiving_grower_delivery_note g
        WHERE g.document_number IN (${placeholders})`,
        docNumbers
      );

      // Map local scans to their GD notes and compute progress
      const byDoc = new Map<string, any>();
      localScans.forEach(s => byDoc.set(s.document_number, s));

      const processed = (gdNotes || []).map(note => {
        const local = byDoc.get(note.document_number) || { scanned_bales: 0, last_scan_date: null };
        const scanned = Number(local.scanned_bales) || 0;
        const expected = Number(note.number_of_bales_delivered) || 0;
        const remaining = Math.max(0, expected - scanned);
        const progressPercentage = expected > 0 ? Math.round((scanned / expected) * 100) : 0;
        let status: 'pending' | 'in_progress' | 'completed' = 'pending';
        if (scanned > 0 && scanned < expected) status = 'in_progress';
        if (expected > 0 && scanned >= expected) status = 'completed';
        return {
          document_number: note.document_number,
          grower_number: note.grower_number || 'Unknown',
          grower_name: note.grower_name || 'Unknown',
          number_of_bales: note.number_of_bales || 0,
          number_of_bales_delivered: expected,
          scanned_bales: scanned,
          remaining_bales: remaining,
          progress_percentage: progressPercentage,
          status,
          last_scan_date: local.last_scan_date
        };
      });

      // 3) Store ALL notes (including completed) for summary display
      setAllGdNotes(processed.filter(n => n.scanned_bales > 0));

      // 4) Show only incomplete notes scanned on this device (for the list display)
      const filtered = processed.filter(n => n.scanned_bales > 0 && n.status !== 'completed');

      // 5) Detect newly completed GD Notes and show acknowledgement
      // Note: The Alert is now handled in actionScanBale() to provide immediate feedback upon scanning the final bale.
      // We keep previousGdNotesStatus updating logic just in case we need state history later,
      // but we removed the duplicate Alert trigger here.
      const previousStatus = previousGdNotesStatus;
      const currentStatus = new Map<string, 'pending' | 'in_progress' | 'completed'>();
      
      // Build current status map from all processed notes (including completed ones)
      processed.forEach(note => {
        currentStatus.set(note.document_number, note.status);
      });
      
      // Update previous status for next comparison
      setPreviousGdNotesStatus(currentStatus);

      console.log('🔍 Device-local pending GD Notes:', filtered.length);
      console.log('🔍 Total GD Notes (including completed):', processed.filter(n => n.scanned_bales > 0).length);
      setAllPendingGdNotes(filtered);
      return filtered;
    } catch (error) {
      console.error('❌ Error fetching device-local pending GD Notes:', error);
      setAllPendingGdNotes([]);
      setAllGdNotes([]);
      return [];
    }
  };

  // Debug watcher for document number visibility issues
  useEffect(() => {
    console.log('👀 documentNumberDisplay changed:', documentNumberDisplay);
  }, [documentNumberDisplay]);

  // Update pending GD Notes list (for current session)
  const updatePendingGdNotes = (updatedScannedBales: any[]) => {
    const gdNotesMap = new Map();
    
    // Group scanned bales by GD Note
    updatedScannedBales.forEach(bale => {
      const docNumber = bale.gdInfo.document_number;
      if (docNumber) {
        if (!gdNotesMap.has(docNumber)) {
          gdNotesMap.set(docNumber, {
            document_number: docNumber,
            grower_number: bale.gdInfo.grower_number ,
            grower_name: bale.gdInfo.grower_name,
            scanned: 0,
            expected: bale.gdInfo.number_of_bales_delivered || 0
          });
        }
        gdNotesMap.get(docNumber).scanned++;
      }
    });

    // Convert to array and calculate progress
    const pendingNotes = Array.from(gdNotesMap.values()).map(note => ({
      ...note,
      progress: `${note.scanned}/${note.expected}`
    }));

    setPendingGdNotes(pendingNotes);
  };

  // Handle navigation parameters
  useEffect(() => {
    if (params.scannedBarcode) {
      setScaleBarcode(params.scannedBarcode as string);
    }
    if (params.row) {
      setRow(params.row as string);
    }
    if (params.lay) {
      setLay(params.lay as string);
    }
    if (params.selling_point_id) {
      setSellingPointId(params.selling_point_id as string);
    }
    if (params.floor_sale_id) {
      setFloorSaleId(params.floor_sale_id as string);
    }
  }, [params.scannedBarcode, params.row, params.lay, params.selling_point_id, params.floor_sale_id]);

  // Auto-process scanned barcode when it comes from camera
  useEffect(() => {
    if (scaleBarcode && params.scannedBarcode === scaleBarcode && !isProcessing) {
      // Only auto-process if this barcode came from the scanner (not manual entry)
      // And not already processing to prevent duplicate scans
      console.log('🔄 Auto-processing scanned barcode:', scaleBarcode);
      setIsProcessing(true);
      actionScanBale().finally(() => {
        // Clear the scannedBarcode param to prevent re-triggering
        router.setParams({ scannedBarcode: undefined });
      });
    }
  }, [scaleBarcode, params.scannedBarcode, actionScanBale, isProcessing, router]);

  // Fetch row capacity when selling point changes
  useEffect(() => {
    if (sellingPointId) {
      fetchRowCapacity();
    }
  }, [sellingPointId, fetchRowCapacity]);

  // Preserve row number when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Scale Bale screen focused - preserving row:', row);
      // Row number is already preserved in state
    }, [row])
  );



  // Accept scanned barcode returned from camera and process automatically
  useEffect(() => {
    if (params.reset === '1') {
      setScaleBarcode('');
      setScannedBales([]);
      setResultMessage('');
      setIsError(false);
      setRowMax('');
      setCurrentGdInfo(null);
      // Also clear persisted data
      (async () => {
        try {
          const raw = (await SafeStorage.getItem(STORAGE_KEY)) || '{}';
          const saved = JSON.parse(raw);
          await SafeStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...saved,
              scannedBales: [],
              rowMax: ''
            })
          );
        } catch {}
      })();
    }
    if (params.scannedBarcode) {
      setScaleBarcode(params.scannedBarcode as string);
      // Don't call actionScanBale here - let useEffect handle it when scaleBarcode updates
    }
    if (params.rowMax) {
      setRowMax(String(params.rowMax));
    }
    if (params.row) {
      const val = String(params.row);
      setRow(val);
      // Auto-populate max bales from PowerSync active row
      (async () => {
        try {
          const lay = await fetchCurrentLay(val);
          if (lay?.max_count) setRowMax(String(lay.max_count));
        } catch {}
      })();
    }
    if (params.selling_point_id) {
      setSellingPointId(String(params.selling_point_id));
      console.log('🔍 Received selling_point_id from navigation:', params.selling_point_id);
    }
    if (params.floor_sale_id) {
      setFloorSaleId(String(params.floor_sale_id));
      console.log('🔍 Received floor_sale_id from navigation:', params.floor_sale_id);
    }
  }, [params.reset, params.scannedBarcode, params.rowMax, params.row, params.selling_point_id, params.floor_sale_id]);

  // Load persisted state (row, rowMax, scannedBales)
  useEffect(() => {
    (async () => {
      try {
        const raw = await SafeStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.row) setRow(saved.row);
        if (saved.rowMax) setRowMax(saved.rowMax);
        if (Array.isArray(saved.scannedBales)) setScannedBales(saved.scannedBales);
      } catch {}
    })();
  }, []);

  // Fetch all pending GD Notes when screen loads
  useEffect(() => {
    fetchAllPendingGdNotes();
  }, []);

  // Refresh latest values whenever screen regains focus (e.g., after editing in Sequencing)
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          // If navigation provided row or rowMax, prefer those
          if (params.rowMax && isActive) {
            setRowMax(String(params.rowMax));
          }
          if (params.row && isActive) {
            setRow(String(params.row));
          }

          const raw = await SafeStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw);
          if (!isActive) return;
          if (!params.row && typeof saved.row === 'string') setRow(saved.row);
          if (!params.rowMax && typeof saved.rowMax === 'string') setRowMax(saved.rowMax);
          if (Array.isArray(saved.scannedBales)) setScannedBales(saved.scannedBales);
          
          // Refresh pending GD Notes when screen regains focus
          if (isActive) {
            await fetchAllPendingGdNotes();
          }
        } catch {}
      })();
      return () => {
        isActive = false;
      };
    }, [params.rowMax, params.row])
  );

  // Persist important fields
  useEffect(() => {
    (async () => {
      try {
        const raw = (await SafeStorage.getItem(STORAGE_KEY)) || '{}';
        const saved = JSON.parse(raw);
        await SafeStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...saved,
            row,
            rowMax,
            scannedBales
          })
        );
      } catch {}
    })();
  }, [row, rowMax, scannedBales]);


  return (
    <SafeAreaView className="flex-1 bg-[#65435C]">
      <Stack.Screen options={{ title: 'Scale Bale', headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 p-4">
          {/* Custom header routing back to Sequencing Scanner */}
          <View className="flex-row items-center justify-between mb-2 bg-white rounded-2xl px-4 py-3">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() =>
                router.replace({
                  pathname: '/receiving/sequencing-scanner',
                })
              }
            >
              <ChevronLeft size={24} color="#65435C" />
              <Text className="text-[#65435C] font-bold text-lg ml-2">
                Scale Bale
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 bg-white rounded-2xl p-5 mt-2"
            keyboardShouldPersistTaps="handled"
          >
        {/* Lay Selection */}
        <FormPicker
          label="Lay"
          value={lay}
          onValueChange={setLay}
          items={layOptions}
          placeholder="Select Lay"
        />
        
        {/* Row Number */}
        <FormInput 
          label="Row Number" 
          value={row} 
          onChangeText={setRow}
          placeholder="Enter row number where bale is positioned" 
        />
        
        {/* Scale Barcode */}
        <FormInput 
          label="Scale Barcode" 
          value={scaleBarcode} 
          onChangeText={setScaleBarcode}
          placeholder="Scan or enter bale barcode" 
        />

        {/* Action Buttons */}
        <View className="mb-6 mt-4 flex-row gap-3">
          {/* Scan Button - Opens camera and processes automatically */}
          <TouchableOpacity
            onPress={handleOpenScanner}
            disabled={isProcessing}
            className={`flex-1 p-4 rounded-lg items-center justify-center ${
              isProcessing ? 'bg-gray-400' : 'bg-[#65435C]'
            }`}
          >
            {isProcessing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">📷 Scan</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result Message */}
        {resultMessage ? (
          <View className={`mb-6 p-4 rounded-lg ${isError ? 'bg-red-100' : 'bg-green-100'}`}>
            <Text className={`${isError ? 'text-red-800' : 'text-green-800'}`}>{resultMessage}</Text>
          </View>
        ) : null}

        {/* Scan Information Display - matching Odoo wizard */}
        {(lastScanSuccess || documentNumberDisplay) && (
          <View className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Current Scan Information</Text>
            {documentNumberDisplay && (
              <View className="mb-2">
                <Text className="text-gray-600">Document Number:</Text>
                <Text className="text-gray-800 font-semibold">{documentNumberDisplay}</Text>
              </View>
            )}
            
            {growerNumber && (
              <View className="mb-2">
                <Text className="text-gray-600">Grower Number:</Text>
                <Text className="text-gray-800 font-semibold">{growerNumber}</Text>
              </View>
            )}
            
            {growerName && (
              <View className="mb-2">
                <Text className="text-gray-600">Grower Name:</Text>
                <Text className="text-gray-800 font-semibold">{growerName}</Text>
              </View>
            )}
            
            {lotNumber && (
              <View className="mb-2">
                <Text className="text-gray-600">Lot Number:</Text>
                <Text className="text-gray-800 font-semibold">{lotNumber}</Text>
              </View>
            )}
            
            {groupNumber && (
              <View className="mb-2">
                <Text className="text-gray-600">Group Number:</Text>
                <Text className="text-gray-800 font-semibold">{groupNumber}</Text>
              </View>
            )}
            
            {(totalScanned > 0 || totalDelivered > 0) && (
            <View className="mt-3 pt-3 border-t border-gray-300">
              <Text className="text-gray-600">Progress:</Text>
                <Text className="text-gray-800 font-semibold text-lg">{totalScanned}/{totalDelivered}</Text>
                {totalScanned >= totalDelivered && totalDelivered > 0 && (
                  <Text className="text-green-600 font-semibold mt-2">✅ Delivery Complete!</Text>
                )}
            </View>
            )}
          </View>
        )}

        {/* Comprehensive GD Notes List and Summary */}
        <View className="mb-4 p-4 bg-blue-50 rounded-lg">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-semibold text-blue-800">📋 GD Notes</Text>
            <TouchableOpacity
              onPress={fetchAllPendingGdNotes}
              className="bg-blue-600 px-3 py-1 rounded-lg"
            >
              <Text className="text-white font-semibold text-xs">🔄 Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Show list only if there are pending/in_progress notes */}
          {allPendingGdNotes.length > 0 && (
            <>
              {allPendingGdNotes.map((note, index) => (
              <View key={index} className="mt-3 p-4 bg-white rounded-lg border border-blue-200">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-gray-800 font-bold text-lg">{note.document_number}</Text>
                    <Text className="text-gray-600 mt-1">Grower: {note.grower_name} ({note.grower_number})</Text>
                    <Text className="text-gray-500 text-sm mt-1">
                      Delivered: {note.number_of_bales_delivered} bales | Scanned: {note.scanned_bales} bales
                    </Text>
                    {note.last_scan_date && (
                      <Text className="text-gray-400 text-xs mt-1">
                        Last scan: {new Date(note.last_scan_date).toLocaleString()}
                      </Text>
                    )}
          </View>
                  
                  <View className="ml-3 items-end">
                    <View className={`px-3 py-1 rounded-full ${
                      note.status === 'completed' ? 'bg-green-100' : 
                      note.status === 'in_progress' ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <Text className={`text-xs font-bold ${
                        note.status === 'completed' ? 'text-green-800' : 
                        note.status === 'in_progress' ? 'text-orange-800' : 'text-gray-800'
                      }`}>
                        {note.status === 'completed' ? '✅ Complete' : 
                         note.status === 'in_progress' ? '🔄 In Progress' : '⏳ Pending'}
                      </Text>
                    </View>
                    <Text className="text-gray-600 text-xs mt-1">{note.progress_percentage}%</Text>
                  </View>
                </View>
                
                {/* Progress fraction */}
                <View className="mt-3">
                  <Text className="text-gray-700 font-semibold text-base">
                    {note.scanned_bales}/{note.number_of_bales_delivered}
                  </Text>
                </View>
                
                {/* Status-specific actions */}
                <View className="mt-3">
                  {note.status === 'completed' && (
                    <View className="bg-green-50 p-2 rounded border border-green-200">
                      <Text className="text-green-700 text-sm font-medium">
                        ✅ Delivery completed.
                      </Text>
                    </View>
                  )}
                  
                  {note.status === 'in_progress' && (
                    <View className="bg-orange-50 p-2 rounded border border-orange-200">
                      <Text className="text-orange-700 text-sm font-medium">
                        ⏳ {note.remaining_bales} bales remaining to scan
                  </Text>
                    </View>
                  )}
                  
                  {note.status === 'pending' && (
                    <View className="bg-gray-50 p-2 rounded border border-gray-200">
                      <Text className="text-gray-600 text-sm">
                        📦 Ready to start scanning {note.number_of_bales_delivered} bales
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              ))}
            </>
          )}

          {/* Summary - Always visible, shows all notes including completed */}
          <View className="mt-4 p-3 bg-white rounded border border-blue-200">
            <Text className="text-blue-800 font-semibold text-sm mb-2">
              📊 Summary: {allGdNotes.length} GD Note{allGdNotes.length !== 1 ? 's' : ''} scanned
            </Text>
            <View className="flex-row justify-between text-xs">
              <Text className="text-blue-600">
                Pending: {allGdNotes.filter(n => n.status === 'pending').length}
              </Text>
              <Text className="text-orange-600">
                In Progress: {allGdNotes.filter(n => n.status === 'in_progress').length}
              </Text>
              <Text className="text-green-600">
                Completed: {allGdNotes.filter(n => n.status === 'completed').length}
              </Text>
            </View>
            <Text className="text-blue-600 text-xs mt-1">
              Total bales: {allGdNotes.reduce((sum, note) => sum + note.scanned_bales, 0)} / {allGdNotes.reduce((sum, note) => sum + note.number_of_bales_delivered, 0)} scanned
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <SuccessToast
        visible={showSuccess}
        message={successMessage}
        onHide={() => setShowSuccess(false)}
      />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ScaleBaleScreen;