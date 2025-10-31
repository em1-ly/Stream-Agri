import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import React from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { powersync } from '@/powersync/system';
import { BaleRecord, GrowerDeliveryNoteRecord } from '@/powersync/Schema';
import { SuccessToast } from '@/components/SuccessToast';
import { Picker } from '@react-native-picker/picker';

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
        style={{ height: 50 }}
      >
        <Picker.Item label={placeholder} value="" />
        {items.map((item) => (
          <Picker.Item key={item.value} label={item.label} value={item.value} />
        ))}
      </Picker>
    </View>
  </View>
);

const STORAGE_KEY = 'receiving:sequencingFormState';

const ScaleBaleScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  
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
  const [autoProcessTimeout, setAutoProcessTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  // Lay options for the picker
  const layOptions = [
    { label: 'Lay 1', value: '1' },
    { label: 'Lay 2', value: '2' },
    { label: 'Lay 3', value: '3' },
    { label: 'Lay 4', value: '4' },
    { label: 'Lay 5', value: '5' },
    { label: 'Lay 6', value: '6' },
  ];

  // Original actionScanBale function with enhanced error handling
  const actionScanBale = useCallback(async () => {
    if (!scaleBarcode) {
      setResultMessage('Please enter a barcode');
      setIsError(true);
      return;
    }

    if (!row.trim()) {
      setResultMessage('Please enter a row number');
      setIsError(true);
      return;
    }

    // Do not block UI with a spinner; respond instantly
    setResultMessage('');
    setIsError(false);

    try {
      // OFFLINE: Update UI state and local counters without server calls
      setLastScanSuccess(true);

      // Use the current scanned barcode to fetch local info before clearing input
      const scanned = scaleBarcode;

      // Local: resolve bale + progress from PowerSync
      try {
        console.log('🔍 Looking up bale locally for scanned barcode:', scanned);
        const bale = await powersync.get<any>(
          `SELECT 
              b.document_number,
              b.grower_number,
              b.lot_number,
              b.group_number,
              b.grower_delivery_note_id
           FROM receiving_bale b
          WHERE b.scale_barcode = ? OR b.barcode = ?
          ORDER BY COALESCE(b.write_date, b.create_date) DESC
          LIMIT 1`,
          [scanned, scanned]
        );

        console.log('🔍 Local bale row:', bale);
        if (bale) {
          setGrowerNumber(bale.grower_number || '');
          setLotNumber(bale.lot_number || '');
          setGroupNumber(bale.group_number || '');
          let docNum = bale.document_number || '';
          const gdnId = bale.grower_delivery_note_id || null;
          if (!docNum && bale.grower_delivery_note_id) {
            try {
              const gdn = await powersync.get<any>(
                `SELECT document_number FROM receiving_grower_delivery_note WHERE id = ? LIMIT 1`,
                [bale.grower_delivery_note_id]
              );
              docNum = gdn?.document_number || '';
              console.log('🔗 Resolved document number via GDN id:', docNum);
            } catch (e) {
              console.warn('⚠️ Failed to resolve document number via GDN id', e);
            }
          }
          setDocumentNumberDisplay(docNum);
          console.log('🧭 Set documentNumberDisplay to:', docNum);

          // Prevent duplicate scans for the same delivery and barcode
          let duplicateFound = false;
          try {
            // Require we have some linkage to a delivery before recording
            if (!docNum && !gdnId) {
              console.warn('⚠️ Skipping sequencing insert: missing document_number and grower_delivery_note_id');
              duplicateFound = true; // prevent downstream progress bump
              setResultMessage('Could not resolve delivery for this bale; not recorded.');
              setIsError(true);
            }

            const existingRows = await powersync.getAll<any>(
              `SELECT id FROM receiving_curverid_bale_sequencing_model
                WHERE (barcode = ? OR scale_barcode = ?)
                  AND ((document_number IS NOT NULL AND document_number = ?) OR (grower_delivery_note_id IS NOT NULL AND grower_delivery_note_id = ?))
                LIMIT 1`,
              [scanned, scanned, docNum || '', gdnId || '']
            );
            const alreadyExists = Array.isArray(existingRows) && existingRows.length > 0;
            if (alreadyExists) {
              duplicateFound = true;
              setResultMessage('This bale has already been scanned for this delivery.');
              setIsError(true);
            } else {
              // Insert into local sequencing table for progress tracking
              const seqId = `seq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              const nowIso = new Date().toISOString();
              await powersync.execute(
                `INSERT INTO receiving_curverid_bale_sequencing_model (
                   id, document_number, grower_delivery_note_id, scale_barcode, barcode, "row", lay, selling_point_id, floor_sale_id, scan_date, scan_datetime, create_date, write_date
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?, ?)`,
                [
                  seqId,
                  docNum || null,
                  gdnId || null,
                  scanned,
                  scanned,
                  parseInt(row, 10) || null,
                  lay || null,
                  sellingPointId ? Number(sellingPointId) : null,
                  floorSaleId ? Number(floorSaleId) : null,
                  nowIso,
                  nowIso,
                  nowIso
                ]
              );
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

          // Compute progress for the same document_number
          if (docNum || gdnId) {
            const counts = await powersync.get<any>(
              `SELECT 
                   (SELECT COUNT(DISTINCT COALESCE(barcode, scale_barcode)) FROM receiving_curverid_bale_sequencing_model WHERE (document_number = ? OR grower_delivery_note_id = ?)) AS scanned_count,
                   (SELECT COALESCE(number_of_bales_delivered, number_of_bales, 0) FROM receiving_grower_delivery_note WHERE (document_number = ? OR id = ?) LIMIT 1) AS expected_count`,
              [docNum || '', gdnId || '', docNum || '', gdnId || '']
            );
            setTotalScanned(Number(counts?.scanned_count) || 0);
            setTotalDelivered(Number(counts?.expected_count) || 0);

            // Auto-send to ticket printing when complete
            const scannedCnt = Number(counts?.scanned_count) || 0;
            const expectedCnt = Number(counts?.expected_count) || 0;
            if (expectedCnt > 0 && scannedCnt >= expectedCnt) {
              console.log('🎉 GD Note complete locally. Triggering ticket printing for', docNum);
              try {
                await createTicketPrintingBatch(docNum);
                setSuccessMessage('GD Note sent to Ticket Printing');
                setShowSuccess(true);
                Alert.alert('✅ Success', `Delivery ${docNum} sent to Ticket Printing!`);
              } catch (e) {
                console.warn('⚠️ Ticket printing trigger failed (will remain manual):', e);
              }
            }
          }
        } else {
          // Fallback: clear last scan info but keep progress unchanged
          setGrowerNumber('');
          setLotNumber('');
          setGroupNumber('');
          setDocumentNumberDisplay('');
          console.log('🧭 Cleared documentNumberDisplay (no local bale found)');
        }
      } catch (e) {
        console.warn('⚠️ Local progress fetch failed', e);
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
      setScaleBarcode('');

      // Optionally refresh pending list (already local)
      try {
        await fetchAllPendingGdNotes();
      } catch {}

    } catch {
      setResultMessage('❌ Error processing scan offline');
      setIsError(true);
      setLastScanSuccess(false);
    } finally {
      // Keep isProcessing unchanged to avoid UI lag
    }
  }, [scaleBarcode, row, lay, sellingPointId, floorSaleId, currentRowBales, rowCapacity]);

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

  const createTicketPrintingBatch = async (documentNumber?: string) => {
    try {
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      
      // Use provided document number or fall back to currentGdInfo
      const gdDocumentNumber = documentNumber || currentGdInfo?.document_number;
      
      if (!serverURL || !token || !gdDocumentNumber) {
        throw new Error('Missing server configuration or GD Note document number');
      }
      
      console.log('🔍 Creating ticket printing batch for GD Note:', gdDocumentNumber);
      
      const normalized = serverURL.startsWith('http') ? serverURL : `https://${serverURL}`;
      const res = await axios.request({
        method: 'POST',
        url: `${normalized}/api/fo/receiving/ticket_printing_batch`,
        headers: {
          'Content-Type': 'application/json',
          'X-FO-Token': token
        },
        data: {
          params: {
            document_number: gdDocumentNumber
          }
        }
      });
      
      console.log('🔍 Ticket printing API response:', res.data);
      
      const result = res?.data?.result || res?.data;
      const ok = result?.success ?? false;
      if (!ok) {
        throw new Error(result?.message || 'Server did not confirm success');
      }
      
      // Return success details for better user feedback
      return {
        success: true,
        batchId: result.batch_id || 'N/A',
        message: result.message || 'Ticket printing batch created successfully'
      };
    } catch (e: any) {
      console.error('Ticket printing batch create failed', e);
      return { success: false, error: e?.message || 'Unknown error' };
    }
  };

  const scanIntoRow = async (rowNumber: number, barcode?: string) => {
    try {
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      if (!serverURL || !token || !rowNumber) return;
      const normalized = serverURL.startsWith('http') ? serverURL : `https://${serverURL}`;
      await axios.post(
        `${normalized}/api/fo/receiving/rows/scan`,
        { params: { row_number: Number(rowNumber), barcode, lay } },
        { headers: { 'Content-Type': 'application/json', 'X-FO-TOKEN': token } }
      );
    } catch (e) {
      // Silent fail; row screen will refresh from PowerSync
      console.warn('scanIntoRow failed', e);
    }
  };

  const saveBaleToRowTracking = async (rowNumber: number, barcode: string, gdInfo: any) => {
    try {
      console.log('🔍 saveBaleToRowTracking called with:', { rowNumber, barcode, gdInfo });
      
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      
      console.log('🔍 Server config:', { serverURL: !!serverURL, token: !!token });
      
      if (!serverURL || !token) {
        console.warn('❌ Missing server configuration for row bale tracking');
        return;
      }

      const normalized = serverURL.startsWith('http') ? serverURL : `https://${serverURL}`;
      console.log('🔍 Making API call to:', `${normalized}/api/fo/receiving/sequencing_scan`);
      
      // Use selling point and floor sale from navigation parameters
      // Based on database: Floor Sale ID 1 ("SS") has sale_point_id=7
      const sellingPointIdToUse = sellingPointId || '7'; // Fallback to sale_point_id=7 (matches Floor Sale ID 1)
      const floorSaleIdToUse = floorSaleId || '1'; // Fallback to SS (ID 1)
      
      console.log('🔍 Navigation params - sellingPointId:', sellingPointId, 'floorSaleId:', floorSaleId);
      console.log('🔍 State values - sellingPointId:', sellingPointId, 'floorSaleId:', floorSaleId);
      console.log('🔍 Using selling point ID:', sellingPointIdToUse, 'floor sale ID:', floorSaleIdToUse);
      console.log('🔍 Full request payload:', {
        scale_barcode: barcode,
        row: rowNumber.toString(),
        lay,
        selling_point_id: sellingPointIdToUse,
        floor_sale_id: floorSaleIdToUse
      });
      
      const response = await axios.post(
        `${normalized}/api/fo/receiving/sequencing_scan`,
        { 
          params: { 
            scale_barcode: barcode,
            row: rowNumber.toString(),
            lay,
            selling_point_id: sellingPointIdToUse,
            floor_sale_id: floorSaleIdToUse
          } 
        },
        { headers: { 'Content-Type': 'application/json', 'X-FO-Token': token } }
      );

      console.log('🔍 API Response:', response.data);
      console.log('🔍 Response status:', response.status);
      
      const result = response.data;
      console.log('🔍 Full API response:', JSON.stringify(result, null, 2));
      console.log('🔍 Result success:', result?.result?.success);
      console.log('🔍 Result message:', result?.result?.message);
      
      if (result && result.result && result.result.success) {
        console.log('✅ Bale scanned successfully:', result.message);
        console.log('📊 Row info:', result.row_info);
        console.log('📦 Bale info:', result.bale_info);
        
        if (result.delivery_completed) {
          console.log('🎉 Delivery completed!', result.message);
        }
        
        // Refresh PowerSync data to show updated row management
        try {
          await powersync.execute('SELECT 1'); // Trigger sync
          console.log('🔄 PowerSync data refreshed');
        } catch (e) {
          console.warn('⚠️ PowerSync refresh failed:', e);
        }
        
        return { success: true, result: result.result };
      } else {
        const errorMessage = result?.result?.message || 'Unknown error';
        console.warn('❌ Failed to scan bale:', errorMessage);
        console.log('❌ Full result:', result);
        
        // Clean up HTML tags from error message
        const cleanErrorMessage = errorMessage
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
          .replace(/&amp;/g, '&') // Replace &amp; with &
          .replace(/&lt;/g, '<') // Replace &lt; with <
          .replace(/&gt;/g, '>') // Replace &gt; with >
          .trim();
        
        // Show user-friendly error message
        console.log('🔍 Setting error message:', cleanErrorMessage);
        setResultMessage(`❌ Scan Failed: ${cleanErrorMessage}`);
        setIsError(true);
        console.log('🔍 Error message set in UI');
        
        return { success: false, error: cleanErrorMessage };
      }
    } catch (e: any) {
      console.error('❌ Error scanning bale:', e?.message || e);
      
      // If it's an API error with a response, try to extract the error message
      if (e?.response?.data?.result?.message) {
        const errorMessage = e.response.data.result.message;
        const cleanErrorMessage = errorMessage
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
          .replace(/&amp;/g, '&') // Replace &amp; with &
          .replace(/&lt;/g, '<') // Replace &lt; with <
          .replace(/&gt;/g, '>') // Replace &gt; with >
          .trim();
        
        setResultMessage(`❌ Scan Failed: ${cleanErrorMessage}`);
        setIsError(true);
        return { success: false, error: cleanErrorMessage };
      } else {
        setResultMessage(`❌ Error scanning bale: ${e?.message || 'Unknown error'}`);
        setIsError(true);
        return { success: false, error: e?.message || 'Unknown error' };
      }
    }
  };

  const addBaleToServer = async (documentNumber: string, barcode: string, lot?: string | number, group?: string | number) => {
    try {
      const serverURL = await SecureStore.getItemAsync('odoo_server_ip');
      const token = await SecureStore.getItemAsync('odoo_custom_session_id');
      if (!serverURL || !token) throw new Error('Missing server config');
      const normalized = serverURL.startsWith('http') ? serverURL : `https://${serverURL}`;
      const res = await axios.request({
        method: 'POST',
        url: `${normalized}/api/fo/add-bale/`,
        headers: {
          'Content-Type': 'application/json',
          'X-FO-TOKEN': token
        },
        data: {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            document_number: documentNumber,
            barcode: barcode,
            lot_number: lot ?? null,
            group_number: group ?? null
          },
          id: 1
        }
      });
      const ok = !!res?.data?.result?.success;
      if (!ok) {
        const msg = res?.data?.result?.message || 'Server rejected bale';
        throw new Error(msg);
      }
      return true;
    } catch (e: any) {
      console.error('addBaleToServer failed', e);
      return false;
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

  // Manual trigger for ticket printing (for completed GD Notes)
  const handleManualTicketPrinting = async (documentNumber: string) => {
    try {
      setIsProcessing(true);
      const result = await createTicketPrintingBatch(documentNumber);
      
    if (result.success) {
        setResultMessage(`✅ GD Note ${documentNumber} sent to Ticket Printing! (Batch ID: ${result.batchId})`);
        setSuccessMessage(`Ticket printing batch created! Batch ID: ${result.batchId}`);
        setShowSuccess(true);
      Alert.alert('✅ Success', `Delivery ${documentNumber} sent to Ticket Printing!`);
        
        // Remove this GD Note from pending list since it's now processed
        setAllPendingGdNotes(prev => prev.filter(note => note.document_number !== documentNumber));
      } else {
        setResultMessage(`❌ Failed to create ticket printing batch: ${result.error}`);
        setIsError(true);
      }
    } catch (error: any) {
      setResultMessage(`❌ Error creating ticket printing batch: ${error.message}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Fetch pending GD Notes scanned on this device (local sequencing), not global pending
  const fetchAllPendingGdNotes = async () => {
    try {
      console.log('🔍 Fetching device-local pending GD Notes (from sequencing model)...');

      // 1) Gather local scans per document_number on this device
      const localScans = await powersync.getAll<any>(
        `SELECT document_number,
                COUNT(DISTINCT COALESCE(barcode, scale_barcode)) AS scanned_bales,
                MAX(write_date) AS last_scan_date
           FROM receiving_curverid_bale_sequencing_model
          WHERE document_number IS NOT NULL AND TRIM(document_number) <> ''
          GROUP BY document_number`
      );

      if (!Array.isArray(localScans) || localScans.length === 0) {
        setAllPendingGdNotes([]);
        return [];
      }

      // Build IN clause safely
      const docNumbers = localScans.map(s => s.document_number).filter(Boolean);
      const placeholders = docNumbers.map(() => '?').join(',');

      // 2) Fetch expected counts for those document_numbers from GD Notes
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

      // 3) Only show notes that were scanned on this device but not finished
      const filtered = processed.filter(n => n.scanned_bales > 0 && n.scanned_bales < n.number_of_bales_delivered);

      console.log('🔍 Device-local pending GD Notes:', filtered.length);
      setAllPendingGdNotes(filtered);
      return filtered;
    } catch (error) {
      console.error('❌ Error fetching device-local pending GD Notes:', error);
      setAllPendingGdNotes([]);
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
    if (scaleBarcode && params.scannedBarcode === scaleBarcode) {
      // Only auto-process if this barcode came from the scanner (not manual entry)
      console.log('🔄 Auto-processing scanned barcode:', scaleBarcode);
      actionScanBale();
    }
  }, [scaleBarcode, params.scannedBarcode, actionScanBale]);

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
    <>
      <ScrollView className="flex-1 bg-white p-5">
        
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
        {lastScanSuccess && (
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
            
            <View className="mt-3 pt-3 border-t border-gray-300">
              <Text className="text-gray-600">Progress:</Text>
              <Text className="text-gray-800 font-semibold">Scanned: {totalScanned} of {totalDelivered}</Text>
            </View>
          </View>
        )}

        {/* Comprehensive Pending GD Notes List */}
        {allPendingGdNotes.length > 0 && (
          <View className="mb-4 p-4 bg-blue-50 rounded-lg">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-semibold text-blue-800">📋 All Pending GD Notes</Text>
          <TouchableOpacity
                onPress={fetchAllPendingGdNotes}
                className="bg-blue-600 px-3 py-1 rounded-lg"
          >
                <Text className="text-white font-semibold text-xs">🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

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
                
                {/* Progress bar */}
                <View className="mt-3 bg-gray-200 rounded-full h-3">
                  <View 
                    className={`h-3 rounded-full ${
                      note.status === 'completed' ? 'bg-green-500' : 
                      note.status === 'in_progress' ? 'bg-orange-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${note.progress_percentage}%` }}
                  />
                </View>
                
                {/* Status-specific actions */}
                <View className="mt-3">
                  {note.status === 'completed' && (
                    <View className="flex-row space-x-2">
                      <TouchableOpacity
                        onPress={() => handleManualTicketPrinting(note.document_number)}
                        disabled={isProcessing}
                        className="bg-green-600 px-4 py-2 rounded-lg flex-1"
                      >
                        <Text className="text-white font-semibold text-sm text-center">OK</Text>
                      </TouchableOpacity>
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
            
            {/* Summary */}
            <View className="mt-4 p-3 bg-white rounded border border-blue-200">
              <Text className="text-blue-800 font-semibold text-sm mb-2">
                📊 Summary: {allPendingGdNotes.length} GD Note{allPendingGdNotes.length !== 1 ? 's' : ''} in system
              </Text>
              <View className="flex-row justify-between text-xs">
                <Text className="text-blue-600">
                  Pending: {allPendingGdNotes.filter(n => n.status === 'pending').length}
                </Text>
                <Text className="text-orange-600">
                  In Progress: {allPendingGdNotes.filter(n => n.status === 'in_progress').length}
                </Text>
                <Text className="text-green-600">
                  Completed: {allPendingGdNotes.filter(n => n.status === 'completed').length}
                </Text>
              </View>
              <Text className="text-blue-600 text-xs mt-1">
                Total bales: {allPendingGdNotes.reduce((sum, note) => sum + note.scanned_bales, 0)} / {allPendingGdNotes.reduce((sum, note) => sum + note.number_of_bales_delivered, 0)} scanned
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
      
      <SuccessToast
        visible={showSuccess}
        message={successMessage}
        onHide={() => setShowSuccess(false)}
      />
    </>
  );
};

export default ScaleBaleScreen;