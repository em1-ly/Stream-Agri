import React, { useState, useEffect } from 'react';
import { Alert, View } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { powersync } from '@/powersync/setup';
import { useSession } from '@/authContext';
import { v4 as uuidv4 } from 'uuid';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useSession();
  const scanType = params.scanType as string || 'document'; // 'document' or 'bale'
  const returnTo = (params.returnTo as string) || '';
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [currentRow, setCurrentRow] = useState<string>((params.row as string) || '');
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState<string>('');
  const [progress, setProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [hasShownCompletionAlert, setHasShownCompletionAlert] = useState(false);
  const [gdnNumber, setGdnNumber] = useState<string>('');

  // Watcher for progress - keeps count in sync directly with DB
  useEffect(() => {
    if (!gdnNumber) return;

    let isCancelled = false;
    
    const updateCounts = async () => {
      try {
        // First resolve the delivery note ID if we only have the number
        const deliveryNote = await powersync.get<any>(
          'SELECT id, number_of_bales_delivered, number_of_bales FROM receiving_grower_delivery_note WHERE document_number = ?',
          [gdnNumber]
        );
        
        if (!deliveryNote || isCancelled) return;

        const expected = deliveryNote.number_of_bales_delivered || deliveryNote.number_of_bales || 0;
        
        const result = await powersync.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id = ?',
          [deliveryNote.id]
        );
        
        if (!isCancelled) {
          const scanned = result?.count || 0;
          setProgress({ scanned, total: expected });
        }
      } catch (e) {
        if (!String(e).includes('empty')) {
          console.warn('Error updating counts for watcher:', e);
        }
      }
    };

    updateCounts();

    const watcher = powersync.watch(
      `SELECT * FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id IN (SELECT id FROM receiving_grower_delivery_note WHERE document_number = '${gdnNumber}')`,
      [],
      { onResult: updateCounts }
    );

    return () => {
      isCancelled = true;
    };
  }, [gdnNumber]);

  // For scale-bale: Process scan but stay on camera screen
  const handleBarcodeScanned = async (barcode: string) => {
    setLastScannedBarcode(barcode);
    
    if (returnTo === 'scale-bale') {
      // Process the scan directly - insert into sequencing table
      setScanStatus('processing');
      try {
        const rowNum = parseInt(currentRow, 10);
        const layNum = params.lay ? parseInt(params.lay as string, 10) : 1;
        const sellingPointId = params.selling_point_id ? parseInt(params.selling_point_id as string, 10) : null;
        const floorSaleId = params.floor_sale_id ? parseInt(params.floor_sale_id as string, 10) : null;
        
        // Pre-validation: Validate row is a valid integer
        if (isNaN(rowNum) || rowNum <= 0) {
          setScanStatus('error');
          setScanMessage('Row number must be valid');
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 2000);
          return;
        }

        // Pre-validation: Validate lay is provided and valid
        if (!layNum || layNum <= 0) {
          setScanStatus('error');
          setScanMessage('Lay number must be valid');
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 2000);
          return;
        }

        // Pre-validation: Validate selling_point_id and floor_sale_id are provided
        if (!sellingPointId) {
          setScanStatus('error');
          setScanMessage('Selling point is required');
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 2000);
          return;
        }

        if (!floorSaleId) {
          setScanStatus('error');
          setScanMessage('Floor sale is required');
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 2000);
          return;
        }

        // Pre-validation: Check that floor sale has a sale_point_id configured
        try {
          const floorSale = await powersync.get<any>(
            `SELECT sale_point_id FROM floor_maintenance_floor_sale WHERE id = ? LIMIT 1`,
            [floorSaleId]
          );
          
          if (!floorSale?.sale_point_id) {
            setScanStatus('error');
            setScanMessage('Location does not have a sell point');
            setTimeout(() => {
              setScanStatus('idle');
              setScanMessage('');
            }, 2000);
            return;
          }
        } catch (e: any) {
          if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
            setScanStatus('error');
            setScanMessage('Invalid floor sale');
            setTimeout(() => {
              setScanStatus('idle');
              setScanMessage('');
            }, 2000);
            return;
          }
          console.warn('⚠️ Error checking floor sale configuration:', e);
        }
        
        // Get bale info with all necessary fields
        let bale: any = null;
        try {
          bale = await powersync.get<any>(
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
            [barcode, barcode]
          );
        } catch (e: any) {
          // powersync.get throws when result set is empty
          if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
            bale = null;
          } else {
            throw e; // Re-throw if it's a different error
          }
        }
        
        // Pre-validation 1: Check if bale exists
        if (!bale) {
          setScanStatus('error');
          setScanMessage(`Bale ${barcode} not found. Ensure bale is added to a delivery note first.`);
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 3000);
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
          setScanStatus('error');
          setScanMessage(`Bale ${barcode} has zero recorded mass. Send it back to the scale to capture the weight.`);
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 3000);
          return;
        }

        // Pre-validation 2: Check for bale errors (if state indicates an error)
        const baleState = (bale.bale_state || '').toLowerCase();
        if (baleState && ['error', 'failed', 'invalid', 'rejected'].includes(baleState)) {
          setScanStatus('error');
          setScanMessage(`Bale has error state: ${bale.bale_state}. Resolve error before sequencing.`);
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 3000);
          return;
        }

        let docNum = bale.document_number || '';
        const gdnId = bale.grower_delivery_note_id || null;
        
        // Set GDN number if we have it from bale
        if (docNum) {
          setGdnNumber(docNum);
        }
        
        // Pre-validation 3: Require we have some linkage to a delivery before recording
        if (!docNum && !gdnId) {
          setScanStatus('error');
          setScanMessage('Bale must be associated with a delivery note before sequencing.');
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 3000);
          return;
        }

        // Get GDN info and validate
        let gdn: any = null;
        if (!docNum && gdnId) {
          try {
            gdn = await powersync.get<any>(
              `SELECT document_number, state, selling_point_id, grower_name FROM receiving_grower_delivery_note WHERE id = ? LIMIT 1`,
              [gdnId]
            );
            docNum = gdn?.document_number || '';
            if (docNum) {
              setGdnNumber(docNum);
            }
            console.log('🔗 Resolved document number via GDN id:', docNum);
          } catch (e: any) {
            if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
              gdn = null;
            } else {
              console.warn('⚠️ Failed to resolve document number via GDN id', e);
            }
          }
        } else if (docNum) {
          try {
            gdn = await powersync.get<any>(
              `SELECT state, selling_point_id, grower_name FROM receiving_grower_delivery_note WHERE document_number = ? LIMIT 1`,
              [docNum]
            );
          } catch (e: any) {
            if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
              gdn = null;
            } else {
              console.warn('⚠️ Failed to check GDN state', e);
            }
          }
        }

        if (gdn) {
          // Pre-validation 4: Check GDN state - must be 'laid' to allow sequencing
          const gdnState = (gdn?.state || '').toLowerCase();
          if (gdnState && gdnState !== 'laid') {
            setScanStatus('error');
            setScanMessage(`Delivery note ${docNum || gdnId} is in state "${gdn?.state || 'unknown'}" and must be "Laid" to allow sequencing.`);
            setTimeout(() => {
              setScanStatus('idle');
              setScanMessage('');
            }, 3000);
            return;
          }

          // Pre-validation 5: Check if delivery note has a selling point
          if (!gdn?.selling_point_id) {
            setScanStatus('error');
            setScanMessage('This delivery does not have a selling point.');
            setTimeout(() => {
              setScanStatus('idle');
              setScanMessage('');
            }, 3000);
            return;
          }

          // Pre-validation 5b: Check that delivery selling point matches floor sale selling point
          if (gdn?.selling_point_id && sellingPointId && floorSaleId) {
            try {
              const floorSale = await powersync.get<any>(
                `SELECT sale_point_id FROM floor_maintenance_floor_sale WHERE id = ? LIMIT 1`,
                [floorSaleId]
              );
              
              if (floorSale?.sale_point_id) {
                const deliverySellingPointId = gdn.selling_point_id;
                const floorSaleSellingPointId = floorSale.sale_point_id;
                
                if (deliverySellingPointId !== floorSaleSellingPointId) {
                  // Get selling point name for better error message
                  let sellingPointName = `Selling Point ${deliverySellingPointId}`;
                  try {
                    const sellingPoint = await powersync.get<any>(
                      `SELECT name FROM floor_maintenance_selling_point WHERE id = ? LIMIT 1`,
                      [deliverySellingPointId]
                    );
                    sellingPointName = sellingPoint?.name || sellingPointName;
                  } catch (e) {
                    // Ignore error, use default name
                  }
                  
                  setScanStatus('error');
                  setScanMessage(`This delivery is for ${sellingPointName}. Please select the correct selling point.`);
                  setTimeout(() => {
                    setScanStatus('idle');
                    setScanMessage('');
                  }, 3000);
                  return;
                }
              } else {
                setScanStatus('error');
                setScanMessage('Error in selecting correct location for sale. This location does not have a sell point.');
                setTimeout(() => {
                  setScanStatus('idle');
                  setScanMessage('');
                }, 3000);
                return;
              }
            } catch (e: any) {
              if (e?.message?.includes('empty') || e?.message?.includes('Result set')) {
                setScanStatus('error');
                setScanMessage('Invalid floor sale configuration');
                setTimeout(() => {
                  setScanStatus('idle');
                  setScanMessage('');
                }, 3000);
                return;
              }
              console.warn('⚠️ Error checking floor sale selling point:', e);
            }
          }
        }

        // Pre-validation 6: Global Duplicate Check
        let duplicateFound = false;
        let duplicateDetails = '';
        try {
            const existingSequencing = await powersync.get<any>(
            `SELECT "row", lay, create_date, delivery_note_id, barcode
             FROM receiving_curverid_bale_sequencing_model 
             WHERE barcode = ?
             LIMIT 1`,
            [barcode]
          );
          
          if (existingSequencing) {
             const rowNum = existingSequencing.row;
             const layNum = existingSequencing.lay;
             const scanDate = existingSequencing.create_date || 'unknown date';
             let formattedDate = scanDate;
             try {
                formattedDate = new Date(scanDate).toLocaleString();
             } catch {}
             
             duplicateFound = true;
             duplicateDetails = `Row ${rowNum}, Lay ${layNum} on ${formattedDate}`;
          }
        } catch (e: any) {
          // Table might not exist yet or empty result
          if (!e?.message?.includes('empty') && !e?.message?.includes('Result set') && !e?.message?.includes('no such table')) {
             console.warn('⚠️ Error checking if bale already sequenced:', e);
          }
        }
        
        if (duplicateFound) {
          setScanStatus('error');
          setScanMessage(`Duplicate Scan. Already sequenced in ${duplicateDetails}.`);
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 3000);
          return;
        }

        // Pre-validation 7: Check if row/lay is full before allowing scan
        try {
          if (!isNaN(rowNum) && layNum !== null && sellingPointId !== null && floorSaleId !== null) {
            // Count existing bales in this row/lay combination for today
            let existingCount = 0;
            try {
              // Get today's date in YYYY-MM-DD format
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
              
              const countResult = await powersync.get<{ count: number }>(
                `SELECT COUNT(*) as count 
                 FROM receiving_curverid_bale_sequencing_model 
                 WHERE "row" = ? AND lay = ? AND selling_point_id = ? AND DATE(create_date) = ?`,
                [rowNum, layNum.toString(), sellingPointId, todayStr]
              );
              existingCount = countResult?.count || 0;
            } catch (countError: any) {
              // Table might not exist yet - treat as 0 count
              if (countError?.message?.includes('no such table') || countError?.message?.includes('does not exist')) {
                console.log('⚠️ Sequencing table not found yet - treating row/lay as empty');
                existingCount = 0;
              } else if (countError?.message?.includes('empty') || countError?.message?.includes('Result set')) {
                existingCount = 0;
              } else {
                console.warn('⚠️ Error counting existing bales in row/lay:', countError);
              }
            }

            // Check if adding this bale would exceed capacity (default to 5, or dynamic from row management)
            let maxCapacity = 5; 
            try {
               const rowConfig = await powersync.get<any>(
                `SELECT max_count 
                   FROM receiving_curverid_row_management
                  WHERE row_number = ? AND date = date('now') AND is_active_lay = 1
                 ORDER BY COALESCE(write_date, create_date) DESC LIMIT 1`,
                [rowNum.toString()]
              );
              if (rowConfig?.max_count) {
                maxCapacity = rowConfig.max_count;
              }
            } catch (e) {
              // Fallback to 5 if check fails or table doesn't exist
            }

            if (existingCount >= maxCapacity) {
              Alert.alert(
                'Row Full',
                `Row ${rowNum} Lay ${layNum} is full (${existingCount}/${maxCapacity} bales). Please select a different row.`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.push({
                        pathname: '/receiving/scale-bale',
                        params: {
                          scannedBarcode: barcode,
                          row: currentRow,
                          lay: params.lay as string,
                          selling_point_id: params.selling_point_id as string,
                          floor_sale_id: params.floor_sale_id as string
                        }
                      });
                    }
                  }
                ]
              );
              return;
            }
          }
        } catch (capacityError) {
          console.warn('⚠️ Error checking row/lay capacity:', capacityError);
          // Continue with validation - worst case we'll get server error
        }
        
        // All pre-validations passed - insert sequencing record
        const nowIso = new Date().toISOString();
        const seqId = uuidv4();
        const currentUserId = (session as any)?.userId || (session as any)?.uid;
        
        await powersync.execute(
          `INSERT INTO receiving_curverid_bale_sequencing_model (
             id, barcode, delivery_note_id, "row", lay, selling_point_id, floor_sale_id, create_date, write_date, create_uid
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            seqId,
            barcode,
            gdnId ? parseInt(gdnId, 10) : null,
            rowNum || null,
            layNum ? layNum.toString() : null,
            sellingPointId,
            floorSaleId,
            nowIso,
            nowIso,
            currentUserId ? parseInt(String(currentUserId), 10) : null
          ]
        );
        
        // Note: We don't need to manually set progress here because the watcher effect
        // will automatically pick up the new count when receiving_curverid_bale_sequencing_model updates.
        // This prevents "double counting" or optimistic update issues.
        
        setScanStatus('success');
        setScanMessage('✅ Scanned successfully');
        console.log('✅ Sequencing record inserted from camera screen');

        // Check if row is now full after this scan (matching sequencing_wizard.py logic)
        if (!isNaN(rowNum) && layNum !== null && sellingPointId !== null) {
          try {
            // Get today's date in YYYY-MM-DD format
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Count current bales in this row/lay/selling_point combination for today
            // This matches get_row_capacity_used() in Python: counts by selling_point_id, row, lay, and scan_date
            // Using create_date since scan_date may not be in local schema
            const countResult = await powersync.get<{ count: number }>(
              `SELECT COUNT(*) as count 
               FROM receiving_curverid_bale_sequencing_model 
               WHERE selling_point_id = ? 
                 AND "row" = ? 
                 AND lay = ? 
                 AND DATE(create_date) = ?`,
              [sellingPointId, rowNum, layNum.toString(), todayStr]
            );
            const currentCount = countResult?.count || 0;

            // Get row capacity (matching get_row_capacity() in Python)
            // First try to get from row_configuration for this specific row, then fall back to selling_point.row_capacity, then default 50
            let rowCapacity = 50; // Default capacity (matches Python default)
            try {
              // Try to get row-specific capacity from row_configuration (may not be in schema)
              try {
                const rowConfig = await powersync.get<any>(
                  `SELECT max_capacity 
                   FROM floor_maintenance_row_configuration
                   WHERE selling_point_id = ? 
                     AND row_number = ? 
                     AND active = 1
                   LIMIT 1`,
                  [sellingPointId, rowNum]
                );
                if (rowConfig?.max_capacity) {
                  rowCapacity = rowConfig.max_capacity;
                  console.log(`📦 Using row-specific capacity from row_configuration: ${rowCapacity}`);
                }
              } catch (rowConfigError: any) {
                // Row configuration table may not exist in schema, try selling_point
                if (rowConfigError?.message?.includes('no such table') || rowConfigError?.message?.includes('empty')) {
                  console.log('📦 Row configuration table not found, trying selling_point.row_capacity');
                } else {
                  throw rowConfigError;
                }
              }
              
              // If row_config not found, try selling_point.row_capacity (may not be in schema)
              if (rowCapacity === 50) {
                try {
                  const sellingPoint = await powersync.get<any>(
                    `SELECT row_capacity 
                     FROM floor_maintenance_selling_point
                     WHERE id = ?
                     LIMIT 1`,
                    [sellingPointId]
                  );
                  if (sellingPoint?.row_capacity) {
                    rowCapacity = sellingPoint.row_capacity;
                    console.log(`📦 Using selling_point.row_capacity: ${rowCapacity}`);
                  }
                } catch (spError: any) {
                  // row_capacity field may not be in schema
                  if (spError?.message?.includes('no such column')) {
                    console.log('📦 row_capacity field not in schema, using default 50');
                  } else {
                    throw spError;
                  }
                }
              }
            } catch (e) {
              // Fallback to default if check fails
              console.warn('⚠️ Could not get row capacity, using default 50:', e);
            }

            console.log(`📦 Row Capacity: ${rowCapacity} for Row ${rowNum}, Lay ${layNum}, Selling Point ${sellingPointId}`);

            // If row is now full, show alert and navigate to scale-bale
            if (currentCount >= rowCapacity) {
              console.log(`📦 Row ${rowNum} Lay ${layNum} is now full (${currentCount}/${rowCapacity} bales) - navigating to scale-bale`);
              Alert.alert(
                '✅ Row Full!',
                `Row ${rowNum} Lay ${layNum} is now full (${currentCount}/${rowCapacity} bales). Navigating to scale-bale screen.`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.push({
                        pathname: '/receiving/scale-bale',
                        params: {
                          scannedBarcode: barcode,
                          row: currentRow,
                          lay: params.lay as string,
                          selling_point_id: params.selling_point_id as string,
                          floor_sale_id: params.floor_sale_id as string
                        }
                      });
                    }
                  }
                ]
              );
              return;
            }
          } catch (rowCheckError) {
            console.warn('⚠️ Error checking if row is full:', rowCheckError);
            // Continue with other checks even if this fails
          }
        }

        // Check completion immediately (optional, but good for UX)
        if (gdnId || docNum) {
           try {
             const deliveryStats = await powersync.get<any>(
               `SELECT 
                  (SELECT COUNT(*) FROM receiving_curverid_bale_sequencing_model WHERE delivery_note_id = gdn.id) as scanned_count,
                  COALESCE(gdn.number_of_bales_delivered, gdn.number_of_bales, 0) as expected_count
                FROM receiving_grower_delivery_note gdn
                WHERE ${docNum ? 'gdn.document_number = ?' : 'gdn.id = ?'}`,
               [docNum || gdnId]
             );
             
             if (deliveryStats) {
               const scanned = deliveryStats.scanned_count || 0;
               const expected = deliveryStats.expected_count || 0;
               if (expected > 0 && scanned >= expected && !hasShownCompletionAlert) {
                  setHasShownCompletionAlert(true);
                  Alert.alert(
                    '🎉 Delivery Complete! 🎉',
                    '✅ Delivery note completed and sent to ticket printing. 🌟',
                    [{ text: 'OK' }]
                  );
               }
             }
           } catch (e) { console.warn('Error checking completion:', e); }
        }
        
        // Reset status after 1.5 seconds to allow next scan
        setTimeout(() => {
          setScanStatus('idle');
          setScanMessage('');
        }, 1500);
        
      } catch (e: any) {
        console.error('Error processing scan on camera:', e);
        setScanStatus('error');
        setScanMessage(e?.message || 'Scan failed');
        setTimeout(() => {
          setScanStatus('idle');
          setScanMessage('');
        }, 2000);
      }
      // Don't navigate - stay on camera
      return;
    }
    
    // For other flows, navigate as before
    if (returnTo === 'sequencing') {
      router.push({
        pathname: '/receiving/sequencing-scanner',
        params: { scannedBarcode: barcode }
      });
    } else if (returnTo === '/receiving/add-new-bale' || returnTo === 'add-new-bale') {
      // Use replace so navigation back to the form is immediate and doesn't grow the stack
      router.replace({
        pathname: '/receiving/add-new-bale',
        params: {
          scannedBaleBarcode: barcode,
          documentNumber: (params.documentNumber as string) || '',
          hessianId: params.hessianId as string,
          locationId: params.locationId as string,
          hessianName: params.hessianName as string,
          locationName: params.locationName as string,
          preserveState: 'true'
        }
      });
    } else if (returnTo === 'edit-bale') {
      // Return to edit bale screen with scanned barcode
      // Use replace to avoid adding to navigation stack
      const baleId = params.baleId as string;
      const deliveryNoteId = params.deliveryNoteId as string;
      router.replace({
        pathname: '/receiving/edit-bale',
        params: {
          baleId: baleId,
          deliveryNoteId: deliveryNoteId || '',
          scannedBarcode: barcode
        }
      });
    } else if (scanType === 'bale') {
      const docNum = params.documentNumber as string;
      // Use replace so navigation back to the GD Note screen is immediate and doesn't grow the stack
      router.replace({
        pathname: '/receiving/add-bale-to-gd-note',
        params: {
          scannedBaleBarcode: barcode,
          documentNumber: docNum,
          preserveState: 'true'
        }
      });
    } else {
      // Fallback: also prefer replace for snappier return to the target screen
      router.replace({
        pathname: '/receiving/add-bale-to-gd-note',
        params: { scannedBarcode: barcode }
      });
    }
  };

  const handleClose = () => {
    // For scale-bale, all scanning and saving is handled on this camera screen.
    // When closing, just go back without sending a barcode so Scale Bale doesn't auto-process again.
    if (returnTo === 'scale-bale') {
      router.back();
      return;
    }
    router.back();
  };

  return (
    <>
    <View className="flex-1 bg-[#65435C]" >
      <Stack.Screen options={{ headerShown: false, title: 'Barcode Scanner' }} />
      
        <BarcodeScanner
          scanType={scanType as 'document' | 'bale'}
          onBarcodeScanned={handleBarcodeScanned}
          onClose={handleClose}
          title={scanType === 'bale' ? 'Scan Bale Barcode' : 'Scan Document Number'}
          subtitle={scanStatus === 'processing' ? 'Processing...' : scanMessage || "Position the barcode within the frame"}
          displayInfo={{
            barcode: lastScannedBarcode,
            row: currentRow,
            progress: progress,
            gdnNumber: gdnNumber
          }}
          stayOnCamera={returnTo === 'scale-bale'}
          scanStatus={scanStatus}
        />
        
      </View>
    </>
  );
}
