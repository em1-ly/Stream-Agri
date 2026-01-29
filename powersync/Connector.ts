import { AbstractPowerSyncDatabase, PowerSyncBackendConnector, UpdateType } from "@powersync/react-native";
import axios from "axios";
import * as SecureStore from 'expo-secure-store';
import { useSession } from "@/authContext";
import { powersync } from "./system";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Helper function to detect network errors (should be retried)
const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = (error?.message || String(error) || '').toLowerCase();
  const errorCode = error?.code || '';
  
  // Check for network-related error messages
  if (errorMessage.includes('network error') || 
      errorMessage.includes('network request failed') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('enotfound')) {
    return true;
  }
  
  // Check for network-related error codes
  if (errorCode === 'ECONNREFUSED' || 
      errorCode === 'ETIMEDOUT' || 
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'EAI_AGAIN') {
    return true;
  }
  
  // Axios network errors: request made but no response received
  if (error?.request && !error?.response) {
    return true;
  }
  
  return false;
};

// Helper function to write to the local logs table
const logToSystem = async (type: 'success' | 'error' | 'warning', message: string, op?: any, details?: any) => {
  try {
    const tableName = op?.table || 'N/A';
    const recordId = op?.id ? String(op.id) : 'N/A'; // Ensure recordId is a string
    const now = new Date().toISOString();

    if (type === 'error' && tableName !== 'N/A' && recordId !== 'N/A') {
      let existingError: { id: string; retry_count: number } | null = null;
      try {
        // Use a try-catch block because .get() throws if no record is found
        existingError = await powersync.get<{ id: string; retry_count: number }>(
          'SELECT id, retry_count FROM system_logs WHERE table_name = ? AND record_id = ? AND type = ?',
          [tableName, recordId, 'error']
        );
      } catch (e) {
        // This is expected if no log exists yet
        existingError = null;
      }

      if (existingError) {
        // Update existing error log
        const newRetryCount = (existingError.retry_count || 0) + 1;
        await powersync.execute(
          'UPDATE system_logs SET message = ?, details = ?, last_seen_at = ?, retry_count = ? WHERE id = ?',
          [message, JSON.stringify(details) || null, now, newRetryCount, existingError.id]
        );
        return; // Exit after updating
      }
    }

    // Insert new log for successes or non-duplicate errors
    await powersync.execute(
      'INSERT INTO system_logs (id, created_at, last_seen_at, retry_count, type, message, table_name, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        uuidv4(),
        now,
        now,
        1, // Initial count is 1
        type,
        message,
        tableName,
        recordId,
        JSON.stringify(details) || null
      ]
    );
  } catch (e) {
    console.error('Failed to write to system_logs:', e);
  }
};
export class Connector implements PowerSyncBackendConnector {
  /**
  * Implement fetchCredentials to obtain a JWT from your authentication service.
  * See https://docs.powersync.com/installation/authentication-setup
  * If you're using Supabase or Firebase, you can re-use the JWT from those clients, see:
  * https://docs.powersync.com/installation/authentication-setup/supabase-auth
  * https://docs.powersync.com/installation/authentication-setup/firebase-auth
  */
  async fetchCredentials(database?: AbstractPowerSyncDatabase) {
    const powerSyncURI = await SecureStore.getItemAsync('power_sync_uri')
    const sessionID = await SecureStore.getItemAsync('odoo_admin_session_id')
    const token = await SecureStore.getItemAsync('odoo_custom_session_id')
    const serverURL = await SecureStore.getItemAsync('odoo_server_ip')

    console.log('sessionID', sessionID)
    console.log('token', token)
    console.log('serverURL', serverURL)
    console.log('powerSyncURI', powerSyncURI)

    // Normalize server URL - add https:// if no protocol is present
    const normalizeServerUrl = (url: string | null): string => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `https://${url}`;
    };

    const normalizedServerURL = normalizeServerUrl(serverURL);

    // const powerSyncURI = 'https://6822f5820c28998c28ef1501.powersync.journeyapps.com'
    // const employeeJwt = await SecureStore.getItemAsync('employee_jwt')

    const getEmployeeJwt = async () => {
      const options = {
        method: 'POST',
        url: `${normalizedServerURL}/api/powersync/token`,
        headers: {
          cookie: `${sessionID}`,
          'Content-Type': 'application/json',
          // 'User-Agent': 'insomnia/11.0.2',
          'X-FO-TOKEN': token 
        },
        data: {}
      };
      
      const response = await axios.request(options)
      console.log('getEmployeeJwt response', response.data)
      console.log('getEmployeeJwt response.data.result.token', response.data.result.token)
      if(response.data.result.success) {
        console.log('Authentication successful - data will sync shortly')
      }else {
        console.log('Connection not successful')
      }
      return response.data.result.token
    }

    const employeeJwt = await getEmployeeJwt()
    // If powerSyncURI is null, return null or use a default endpoint
    if (powerSyncURI === null) {
      console.log('No powerSyncURI found')
      return null; // Return null if URI not found
    }
    // console.log('powerSyncURI', powerSyncURI)
    // console.log('employeeJwt', employeeJwt)
    console.log('#####################################################')
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             console.log('Returning credentials to PowerSync: ', powerSyncURI)
  
    return {
      // The PowerSync instance URL or self-hosted endpoint
      endpoint: powerSyncURI,
      token: employeeJwt || '' // Provide empty string as fallback
    };
  }

  /**
  * Implement uploadData to send local changes to your backend service.
  * You can omit this method if you only want to sync data from the database to the client
  * See example implementation here:https://docs.powersync.com/client-sdk-references/react-native-and-expo#3-integrate-with-your-backend
  */
  async uploadData(database: AbstractPowerSyncDatabase) {
    console.log('🔄 uploadData method started...');
    const sessionID = await SecureStore.getItemAsync('odoo_admin_session_id')
    const token = await SecureStore.getItemAsync('odoo_custom_session_id')
    const serverURL = await SecureStore.getItemAsync('odoo_server_ip')

    // Normalize server URL - add https:// if no protocol is present
    const normalizeServerUrl = (url: string | null): string => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `https://${url}`;
    };

    const normalizedServerURL = normalizeServerUrl(serverURL);

    /**
    * For batched crud transactions, use data.getCrudBatch(n);
    * https://powersync-ja.github.io/powersync-js/react-native-sdk/classes/SqliteBucketStorage#getcrudbatch
    */
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      console.log('❌ No pending CRUD transactions found');
      return;
    }

    console.log(`✅ Found transaction with ${transaction.crud.length} operations`);


    try {
      console.log('🧪 Testing iteration...');
      // transaction.crud.forEach((op, index) => {
      //   console.log(`Operation ${index}:`, op);
      // });
    } catch (error) {
      // console.error('❌ Iteration failed:', error);
    }


    let allOpsSucceeded = true;
    const failedOps: Array<{op: any, error: string}> = [];
    
    // Read mobile user info for tagging server-side records
    const mobileUserId = await SecureStore.getItemAsync('odoo_employee_id');
    const mobileUserName = await SecureStore.getItemAsync('odoo_employee_name');

    for (const op of transaction.crud) {
      console.log('🎯 INSIDE FOR LOOP - This should show!');
      // The data that needs to be changed in the remote db
      const record = { ...op.opData, id: op.id };
      // console.log('record', record)
      // console.log('op', op)
      // console.log('op.op', op.op)
      // console.log('op.table', op.table)
      // console.log('op.id', op.id)
      // console.log('op.opData', op.opData)
      
      try {
      switch (op.op) {
        case UpdateType.PUT:
          // TODO: Instruct your backend API to CREATE a record
          // console.log('PUT', record)
          const { id, ...recordData } = record;
          console.log('#####################################################')
          
          // Declare at outer scope for catch block access
          const originalTableName = op.table;
          let createType = originalTableName;
          let shouldDeletePlaceholder = false; // Track if this is a placeholder operation that should be cleaned up
          
          try{
          console.log('#############PUT#################')
          console.log('PUTTING DATA', id)
          console.log('RECORD DATA', recordData)
        
          // Use original table name for special case checks
          console.log('🔍 Processing PUT for table:', originalTableName);
          let tableName = originalTableName;
          createType = tableName;
          let createData: Record<string, any> = { ...recordData };
          
          // Special handling for bale creation - use 'add_bale' type
          if (originalTableName === 'receiving_bale') {
            createType = 'add_bale';
            // Map 'hessian' to 'hessian_id' for API compatibility
            if ('hessian' in createData && !('hessian_id' in createData)) {
              createData['hessian_id'] = createData['hessian'];
              delete createData['hessian'];
            }
            console.log('Bale creation - mapped to add_bale type with hessian_id');
          } else if (originalTableName === 'receiving_curverid_bale_sequencing_model') {
            // Check if this is a resequencing operation (special barcode patterns)
            const barcode = createData.barcode || '';
            
            if (barcode.startsWith('RESEQUENCE_GAP_')) {
              // Parse: RESEQUENCE_GAP_<last_bale_barcode>_<bales_to_skip_count>_<timestamp>
              const match = barcode.match(/^RESEQUENCE_GAP_(.+?)_(\d+)_(\d+)$/);
              if (match) {
                const lastBaleBarcode = match[1];
                const balesToSkipCount = parseInt(match[2], 10) || 1;
                
                createType = 'bale_resequence_prepare_gap';
                shouldDeletePlaceholder = true; // Mark as placeholder operation
                createData = {
                  last_bale_barcode: lastBaleBarcode,
                  bales_to_skip_count: balesToSkipCount,
                };
                console.log('🔍 receiving_curverid_bale_sequencing_model (prepare gap) - Model/Type:', createType);
                console.log('🔍 receiving_curverid_bale_sequencing_model (prepare gap) - mapped data:', JSON.stringify(createData, null, 2));
              } else {
                // Fallback to normal sequencing
                createType = 'bale_sequencing';
                const scaleBarcode = createData.scale_barcode || createData.barcode;
              }
            } else if (barcode.startsWith('RESEQUENCE_SCAN_')) {
              // Parse: RESEQUENCE_SCAN_<last_bale_barcode>_<missed_bale_barcode>_<scanned_count>_<timestamp>
              // Format: RESEQUENCE_SCAN_<last>_<missed>_<count>_<timestamp>
              // Use regex to extract components more reliably
              const match = barcode.match(/^RESEQUENCE_SCAN_(.+?)_(.+?)_(\d+)_(\d+)$/);
              if (match) {
                const lastBaleBarcode = match[1];
                const missedBaleBarcode = match[2];
                const scannedCount = parseInt(match[3], 10) || 0;
                
                createType = 'bale_resequence_scan_missed_bale';
                shouldDeletePlaceholder = true; // Mark as placeholder operation
                createData = {
                  last_bale_barcode: lastBaleBarcode,
                  bale_barcode_to_scan: missedBaleBarcode,
                  bales_to_skip_count: parseInt(createData.bales_to_skip_count || '1', 10),
                  scanned_count: scannedCount,
                  selling_point_id: createData.selling_point_id,
                  floor_sale_id: createData.floor_sale_id,
                  row: createData.row,
                  lay: createData.lay,
                };
                console.log('🔍 receiving_curverid_bale_sequencing_model (scan missed) - Model/Type:', createType);
                console.log('🔍 receiving_curverid_bale_sequencing_model (scan missed) - mapped data:', JSON.stringify(createData, null, 2));
              } else {
                // Fallback to normal sequencing
                createType = 'bale_sequencing';
                const scaleBarcode = createData.scale_barcode || createData.barcode;
                
                // Validate required fields - skip if scale_barcode is missing
                if (!scaleBarcode) {
                  console.warn('⚠️ Skipping bale sequencing upload - scale_barcode is missing', createData);
                  continue; // Skip this operation
                }
                
                createData = {
                  scale_barcode: scaleBarcode,
                  row: createData.row || createData['row'],
                  lay: createData.lay || '1',
                  selling_point_id: createData.selling_point_id,
                  floor_sale_id: createData.floor_sale_id,
                  // Tag with mobile user info so backend can store on sequencing model
                  mobile_user_id: mobileUserId ? Number(mobileUserId) : undefined,
                  mobile_user_name: mobileUserName || undefined,
                };
                console.log('📤 Bale sequencing - mapped to bale_sequencing type:', createData);
              }
            } else {
              // Normal bale sequencing - use 'bale_sequencing' type
            createType = 'bale_sequencing';
            // Map local fields to API fields
            // API expects: scale_barcode, row, lay, selling_point_id, floor_sale_id (+ mobile user info)
            const scaleBarcode = createData.scale_barcode || createData.barcode;
            
            // Validate required fields - skip if scale_barcode is missing
            if (!scaleBarcode) {
              console.warn('⚠️ Skipping bale sequencing upload - scale_barcode is missing', createData);
              continue; // Skip this operation
            }
            
            createData = {
              scale_barcode: scaleBarcode,
              row: createData.row || createData['row'],
              lay: createData.lay || '1',
              selling_point_id: createData.selling_point_id,
              floor_sale_id: createData.floor_sale_id,
              // Tag with mobile user info so backend can store on sequencing model
              mobile_user_id: mobileUserId ? Number(mobileUserId) : undefined,
              mobile_user_name: mobileUserName || undefined,
            };
            console.log('📤 Bale sequencing - mapped to bale_sequencing type:', createData);
            }
          } else if (originalTableName === 'floor_dispatch_note') {
            createType = 'floor_dispatch_create_note';
            // The record 'id' is the client-generated UUID
            createData['id'] = id;
            // mobile_app_id is handled separately by the server (using the 'id' field)
            if ('mobile_app_id' in createData) {
              delete createData['mobile_app_id'];
            }
            // The Odoo wizard programmatically sets the origin from the default selling point
            // and does not accept 'origin_id' or 'selling_point_id' as parameters.
            if ('origin_id' in createData) {
              delete createData['origin_id'];
            }
            if ('selling_point_id' in createData) {
                delete createData['selling_point_id'];
            }
            // The wizard does not accept a 'state' field, as Odoo handles this.
            if ('state' in createData) {
              delete createData['state'];
            }
            
            // Handle driver fields - only include driver_name, driver_national_id, driver_cellphone for new drivers (UUID)
            // For existing drivers (integer ID), only send driver_id
            const driverId = createData['driver_id'];
            if (driverId && typeof driverId === 'string' && !/^\d+$/.test(driverId)) {
              // driver_id is a UUID (new driver), keep driver fields and set driver_id to null
              // Odoo will create the driver using driver_name, driver_national_id, driver_cellphone
              createData['driver_id'] = null;
              // Keep driver_name, driver_national_id, driver_cellphone for new driver creation
            } else if (driverId && typeof driverId === 'string' && /^\d+$/.test(driverId)) {
              // Convert string number to integer and remove driver detail fields
              createData['driver_id'] = parseInt(driverId, 10);
              // Remove driver detail fields for existing drivers - wizard only accepts driver_id
              if ('driver_name' in createData) {
                delete createData['driver_name'];
              }
              if ('driver_national_id' in createData) {
                delete createData['driver_national_id'];
              }
              if ('driver_cellphone' in createData) {
                delete createData['driver_cellphone'];
              }
            } else if (driverId && typeof driverId === 'number') {
              // Already a number (existing driver), remove driver detail fields
              if ('driver_name' in createData) {
                delete createData['driver_name'];
              }
              if ('driver_national_id' in createData) {
                delete createData['driver_national_id'];
              }
              if ('driver_cellphone' in createData) {
                delete createData['driver_cellphone'];
              }
            } else if (!driverId) {
              // No driver_id, remove driver detail fields
              if ('driver_name' in createData) {
                delete createData['driver_name'];
              }
              if ('driver_national_id' in createData) {
                delete createData['driver_national_id'];
              }
              if ('driver_cellphone' in createData) {
                delete createData['driver_cellphone'];
              }
            }
            
            // Handle transport_name for new transporters (when transport_id is a UUID)
            // If transport_id is a UUID (not a number), we need to send transport_name
            // and set transport_id to null so Odoo can create the new transport
            const transportId = createData['transport_id'];
            if (transportId && typeof transportId === 'string' && !/^\d+$/.test(transportId)) {
              // transport_id is a UUID (new transporter), need to get transport name
              try {
                const transport = await database.get<any>(
                  'SELECT name FROM warehouse_transport WHERE id = ? LIMIT 1',
                  [transportId]
                );
                if (transport?.name) {
                  createData['transport_name'] = transport.name;
                  // Set transport_id to null for new transporters - Odoo will create it using transport_name
                  createData['transport_id'] = null;
                }
              } catch (e) {
                console.warn('⚠️ Could not fetch transport name for UUID:', transportId, e);
                // If we can't find the transport, set transport_id to null
                createData['transport_id'] = null;
              }
            } else if (transportId && typeof transportId === 'string' && /^\d+$/.test(transportId)) {
              // Convert string number to integer
              createData['transport_id'] = parseInt(transportId, 10);
            } else if (transportId && typeof transportId === 'number') {
              // Already a number, keep as is
            }
          } else if (originalTableName === 'warehouse_dispatch_note') {
            createType = 'warehouse_dispatch_create_note';
            // The record 'id' is the client-generated UUID
            createData['id'] = id;
            // mobile_app_id is handled separately by the server (using the 'id' field)
            if ('mobile_app_id' in createData) {
              delete createData['mobile_app_id'];
            }
            // Note: instruction_id is kept as-is for the wizard (wizard expects instruction_id, not shipping_instruction_id)
            // The wizard will map it to shipping_instruction_id when creating the actual dispatch note
            // The wizard does not accept derived/readonly fields from the note model
            for (const field of [
              'reference',
              'shipped_bales',
              'shipped_mass',
              'received_bales',
              'received_mass',
              'stacked_mass',
              'total_stacked',
              'state',
              'create_date',
              'write_date',
              'truck_reg',
            ]) {
              if (field in createData) {
                delete createData[field];
              }
            }
            // If no transportation details were provided on the mobile side,
            // mirror the wizard's "No Transportation Details" flag so it
            // does not require transport/driver fields.
            // Note: We now trust the no_transportation_details field from the app
            // and have updated the Odoo wizard to skip validation if mobile_app_id is set.
            const hasTransportDetails =
              createData.transport_id ||
              createData.truck_reg_number ||
              createData.driver_name ||
              createData.driver_national_id ||
              createData.driver_cellphone;
            
            // Only force True if it was NOT explicitly provided by the app
            if (!hasTransportDetails && createData.no_transportation_details === undefined) {
              (createData as any).no_transportation_details = true;
            }

            // Resolve UUIDs for driver_id and transport_id if they are present
            const m2oFields = ['driver_id', 'transport_id'];
            for (const field of m2oFields) {
              const val = createData[field];
              if (val && typeof val === 'string' && val.includes('-')) {
                const relatedTable = field === 'driver_id' ? 'warehouse_driver' : 'warehouse_transport';
                // Try to find by id (for unsynced) or mobile_app_id (for synced)
                const relatedRecord = await database.getOptional<any>(
                  `SELECT id FROM ${relatedTable} WHERE id = ? OR mobile_app_id = ? LIMIT 1`,
                  [val, val]
                );
                if (relatedRecord && relatedRecord.id && !isNaN(Number(relatedRecord.id))) {
                  createData[field] = Number(relatedRecord.id);
                  console.log(`✅ Resolved ${field} UUID ${val} to Odoo ID: ${createData[field]} for PUT`);
                } else {
                  // Send as-is (the Odoo wizard handle_inventory_unified_create resolves UUIDs using mobile_app_id)
                  console.log(`ℹ️ ${field} UUID ${val} not resolved to Odoo ID yet. Sending as-is.`);
                  createData[field] = val;
                }
              }
            }

            // The Odoo wizard now uses 'driver_id' instead of 'driver_name'.
            // Also remove related fields to avoid conflicts during creation.
            for (const field of ['driver_name', 'driver_national_id', 'driver_cellphone']) {
              if (field in createData) {
                delete createData[field];
              }
            }
          } else if (originalTableName === 'floor_dispatch_bale') {
            createType = 'floor_dispatch_add_bale';
            // We need to send the barcode for the wizard logic
            const bale = await database.get<any>('SELECT barcode, scale_barcode FROM receiving_bale WHERE id = ?', [createData.receiving_bale_id]);
            createData['barcode'] = bale?.barcode || bale?.scale_barcode;
            // The API now accepts both UUID (mobile_app_id) and Odoo integer ID
            // So we can send dispatch_note_id as-is, whether it's a UUID or integer
            console.log('🔍 floor_dispatch_bale - Model/Type:', createType);
            console.log('🔍 floor_dispatch_bale - dispatch_note_id:', createData.dispatch_note_id);
            console.log('🔍 floor_dispatch_bale - receiving_bale_id:', createData.receiving_bale_id);
            console.log('🔍 floor_dispatch_bale - Full createData:', JSON.stringify(createData, null, 2));
          } else if (originalTableName === 'warehouse_dispatch_bale') {
            // Distinguish between normal warehouse dispatch and process run dispatch
            const originDocument = createData.origin_document;

            if (originDocument === 'process_run_dispatch') {
              // For process run dispatch, delegate to warehouse.process.run.scan.wizard.action_scan_bale
              createType = 'process_run_dispatch_scan_bale';
              createData = {
                dispatch_note_id: createData.dispatch_note_id,
                barcode: createData.barcode,
              };
              console.log('🔍 warehouse_dispatch_bale (process_run) - Model/Type:', createType);
              console.log('🔍 warehouse_dispatch_bale (process_run) - mapped data:', JSON.stringify(createData, null, 2));
            } else if (originDocument === 'dispatch_pallet') {
              // Pallet dispatch: delegate to warehouse.dispatch.pallet.wizard.action_dispatch_pallet
              createType = 'warehouse_dispatch_action_dispatch_pallet';
              
              // 1) Find the rack barcode from the warehouse_pallet table using the shipped_pallet_id
              let rackBarcode = createData.logistics_barcode; // Fallback
              
              if (createData.shipped_pallet_id) {
                try {
                  const palletRecord = await database.getOptional<any>(
                    'SELECT barcode FROM warehouse_pallet WHERE id = ? OR mobile_app_id = ?',
                    [createData.shipped_pallet_id, createData.shipped_pallet_id]
                  );
                  if (palletRecord?.barcode) {
                    rackBarcode = palletRecord.barcode;
                    console.log(`✅ Resolved rack barcode '${rackBarcode}' for pallet ID ${createData.shipped_pallet_id}`);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to resolve rack barcode for sync:', e);
                }
              }

              createData = {
                dispatch_note_id: createData.dispatch_note_id,
                barcode: rackBarcode,
              };
              console.log('🔍 warehouse_dispatch_bale (pallet) - Model/Type:', createType);
              console.log('🔍 warehouse_dispatch_bale (pallet) - mapped data:', JSON.stringify(createData, null, 2));
            } else {
              // Default: use warehouse_dispatch_add_bale wizard
              createType = 'warehouse_dispatch_add_bale';
              // Map local row to wizard parameters
              const weight = 'shipped_mass' in createData ? createData['shipped_mass'] : undefined;
              createData = {
                dispatch_note_id: createData.dispatch_note_id,
                barcode: createData.barcode,
                logistics_barcode: createData.logistics_barcode,
                weight,
                mass_override_confirmed: true, // Always confirm for background sync
                mobile_app_id: id,
              };
              console.log('🔍 warehouse_dispatch_bale - Model/Type:', createType);
              console.log('🔍 warehouse_dispatch_bale - mapped data:', JSON.stringify(createData, null, 2));
            }
          } else if (originalTableName === 'warehouse_data_capturing') {
            createType = 'warehouse_data_capturing_save';
            // Map fields to match the unified endpoint expectations
            createData = {
              barcode: createData.barcode,
              product_id: createData.product_id || undefined,
              grade: createData.grade || undefined,
              mass: createData.mass || undefined,
              price: createData.price || undefined,
              operation_no: createData.operation_no || undefined,
              tobacco_type: createData.tobacco_type || undefined,
              pickings_weight: createData.pickings_weight || undefined,
              amount: createData.amount || undefined,
            };
            console.log('🔍 warehouse_data_capturing - Model/Type:', createType);
            console.log('🔍 warehouse_data_capturing - mapped data:', JSON.stringify(createData, null, 2));
          } else if (originalTableName === 'warehouse_pallet') {
            createType = 'warehouse_pallet_create';
            // Map to unified endpoint parameters
            createData = {
              warehouse_id: Number(createData.warehouse_id),
              location_id: createData.location_id ? Number(createData.location_id) : undefined,
              barcode: createData.barcode,
              grade_id: Number(createData.grade_id),
              pallet_capacity: Number(createData.pallet_capacity || 12)
            };
            console.log('🔍 warehouse_pallet - Model/Type:', createType);
            console.log('🔍 warehouse_pallet - mapped data:', JSON.stringify(createData, null, 2));
          } else if (originalTableName === 'warehouse_shipped_bale') {
            // Check if this is a satellite dispatch operation
            const isSatelliteDispatch = 
              createData.origin_document === 'satellite_dispatch' || 
              createData.stock_status === 'satellite';
            
            if (isSatelliteDispatch) {
              // Satellite dispatch: mirror warehouse.satellite.scan.wizard.action_scan_bale
              createType = 'satellite_dispatch_scan_bale';
              const weight =
                ('mass' in createData && typeof createData['mass'] === 'number' ? createData['mass'] : undefined) ??
                ('received_mass' in createData && typeof createData['received_mass'] === 'number' ? createData['received_mass'] : undefined) ??
                ('weight' in createData && typeof createData['weight'] === 'number' ? createData['weight'] : undefined) ??
                0.0;
              createData = {
                warehouse_id: createData.warehouse_id,
                location_id: createData.location_id,
                product_id: createData.product_id,
                barcode: createData.barcode || '',
                logistics_barcode: createData.logistics_barcode || '',
                weight: weight,
              };
              console.log('🔍 warehouse_shipped_bale - Satellite Dispatch - Model/Type:', createType);
              console.log('🔍 warehouse_shipped_bale - Satellite Dispatch - mapped data:', JSON.stringify(createData, null, 2));
            } else {
              // Offline carton receiving: mirror warehouse_carton_scan_wizard.action_scan_carton
              createType = 'warehouse_carton_scan_carton';
              const weight =
                ('mass' in createData && typeof createData['mass'] === 'number' ? createData['mass'] : undefined) ??
                ('received_mass' in createData && typeof createData['received_mass'] === 'number' ? createData['received_mass'] : undefined) ??
                0.0;
              createData = {
                warehouse_id: createData.warehouse_id,
                location_id: createData.location_id,
                product_id: createData.product_id,
                barcode: createData.barcode,
                logistics_barcode: createData.logistics_barcode,
                default_weight: weight,
                // Add extra fields for packed products if they exist
                qr_code: createData.qr_code,
                operation_no: createData.operation_no,
                crop_year: createData.crop_year,
                tobacco_type: createData.tobacco_type,
                manufacture_date: createData.manufacture_date,
                product_type: createData.product_type,
                run_case_no: createData.run_case_no,
                package_no: createData.package_no,
                grade_id: createData.grade,
                mass: createData.mass,
                tare: createData.tare,
                gross: createData.gross,
                cnt: createData.cnt,
              };
              console.log('🔍 warehouse_shipped_bale - Carton Scan - Model/Type:', createType);
              console.log('🔍 warehouse_shipped_bale - Carton Scan - mapped data:', JSON.stringify(createData, null, 2));
            }
          } else {
            // For generic tables, transform table name prefixes for Odoo model names
            if (tableName.includes('receiving_curverid_')) {
              tableName = tableName.replace('receiving_curverid_', 'receiving_curverid.')
              createType = tableName;
            } else if (tableName.includes('odoo_gms_')) {
              tableName = tableName.replace('odoo_gms_', 'odoo_gms.')
              createType = tableName;
            } else if (tableName.startsWith('warehouse_') && !tableName.includes('warehouse_shipped_bale') && !tableName.includes('warehouse_dispatch_bale')) {
              createType = tableName.replace('warehouse_', 'warehouse.');
            }
            
            // Ensure the client-generated UUID is always sent as 'id' for model matching
            if (!createData['id']) {
              createData['id'] = id;
            }
          }

          // Only include mobile user info for models that have these fields (whitelist)
          const tablesWithMobileUserFields = ['receiving_grower_delivery_note', 'floor_dispatch_note', 'warehouse_dispatch_note'];
          if (tablesWithMobileUserFields.includes(originalTableName)) {
            if (mobileUserId) {
              createData['mobile_user_id'] = Number(mobileUserId);
            }
            if (mobileUserName) {
              createData['mobile_user_name'] = mobileUserName;
            }
          }

          const options = {
            method: 'POST',
            url: `${normalizedServerURL}/api/fo/create_unified`,
            headers: {
              'Content-Type': 'application/json',
              // 'User-Agent': 'insomnia/11.2.0',
              'X-FO-TOKEN': token
            },
            data: {
              jsonrpc: '2.0',
              method: 'call',
              params: {
                type: createType,
                data: createData
              }
            }
          };
          
          console.log('📤 Sending to unified_create - Model/Type:', createType);
          console.log('📤 Sending to unified_create - Full data:', JSON.stringify(createData, null, 2));
          const response = await axios.request(options)
          console.log('PUT response', response.data)
          console.log('#####################################################')
          // console.log('PUT RECORD', record)
          console.log('#####################################################')
          
          const serverRecord = await response.data
          console.log('serverRecord', serverRecord)
          
          // Check if the server returned an error (either success: false or message_type: 'error')
          if (serverRecord?.result && (serverRecord.result.success === false || serverRecord.result.message_type === 'error')) {
            const errorMessage = serverRecord.result.message || 'Unknown error creating record';
            await logToSystem('error', `Create failed: ${errorMessage}`, op, serverRecord.result);
            
            // For record operations, treat server errors as handled (complete transaction, no retry)
            // This avoids maintaining a hardcoded list of error messages that might miss new errors
            // If it's a record operation (which it always is here), allow transaction to complete
            const warningMessage = `Server rejected record creation for ${createType}: ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
            console.warn(`⚠️ ${warningMessage}`);
            await logToSystem('warning', warningMessage, op, { createType, errorMessage, serverResponse: serverRecord.result });
            // Do NOT throw here – this lets the transaction complete and drops the op
          } else {
            await logToSystem('success', `Record created successfully.`, op, serverRecord.result);

            // For offline carton receiving, remove the local placeholder row once server has created the real record
            if (originalTableName === 'warehouse_shipped_bale') {
              try {
                await database.execute('DELETE FROM warehouse_shipped_bale WHERE id = ?', [id]);
                console.log('🧹 Deleted local placeholder warehouse_shipped_bale with id', id);
              } catch (cleanupError) {
                console.warn('⚠️ Failed to delete local placeholder warehouse_shipped_bale row:', cleanupError);
              }
            }

            // For offline process run or pallet dispatch, remove the local placeholder warehouse_dispatch_bale row
            if (
              originalTableName === 'warehouse_dispatch_bale' &&
              (createType === 'process_run_dispatch_scan_bale' || createType === 'warehouse_dispatch_action_dispatch_pallet')
            ) {
              try {
                await database.execute('DELETE FROM warehouse_dispatch_bale WHERE id = ?', [id]);
                console.log('🧹 Deleted local placeholder warehouse_dispatch_bale with id', id, 'for type', createType);
              } catch (cleanupError) {
                console.warn('⚠️ Failed to delete local placeholder warehouse_dispatch_bale row:', cleanupError);
              }
            }

            // For offline resequencing operations, remove the local placeholder receiving_curverid_bale_sequencing_model row
            // (These are placeholder records used to trigger operations, not real sequencing records)
            if (
              originalTableName === 'receiving_curverid_bale_sequencing_model' &&
              shouldDeletePlaceholder
            ) {
              try {
                await database.execute('DELETE FROM receiving_curverid_bale_sequencing_model WHERE id = ?', [id]);
                console.log('🧹 Deleted local placeholder receiving_curverid_bale_sequencing_model with id', id, 'for type', createType);
              } catch (cleanupError) {
                console.warn('⚠️ Failed to delete local placeholder receiving_curverid_bale_sequencing_model row:', cleanupError);
              }
            }
          }

        }catch(error: any){
          // For record operations, treat all errors as handled (complete transaction, no retry)
          const errorMessage = error?.message || String(error) || 'Unknown error';
          // Network errors should be retried
          if (isNetworkError(error)) {
            console.error(`❌ Network error during PUT for ${createType}: ${errorMessage}. Will retry.`);
            throw error; // Re-throw to trigger PowerSync retry
          }
          
          // For other errors, treat as handled (complete transaction, no retry)
          const warningMessage = `PUT request failed for ${createType}: ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
          console.warn(`⚠️ ${warningMessage}`);
          await logToSystem('warning', warningMessage, op, { error: errorMessage, createType });
          // Do NOT throw here – this lets the transaction complete and drops the op
        }

          break;
        case UpdateType.PATCH:
          // TODO: Instruct your backend API to PATCH a record
         // Get the table name from the operation
         const tableName = op.table;
         let patchId = record.id; // Initial value, might be Odoo ID or UUID
         let odooTableName = ''; // Declare at outer scope for catch block
         let lastSyncedDate: Date = new Date();

         // Try to use mobile_app_id if available in local record
         // Only check tables known to have this column to avoid SQL errors
         const tablesWithMobileId = [
           'warehouse_driver', 
           'warehouse_transport', 
           'warehouse_pallet', 
           'warehouse_dispatch_note', 
           'floor_dispatch_note', 
           'warehouse_missing_dnote'
         ];
         
         if (tablesWithMobileId.includes(tableName)) {
           try {
             const localRec = await database.getOptional<any>(`SELECT mobile_app_id FROM ${tableName} WHERE id = ?`, [record.id]);
             if (localRec?.mobile_app_id) {
               patchId = localRec.mobile_app_id;
               console.log(`ℹ️ Using mobile_app_id ${patchId} for PATCH identifier instead of local id ${record.id}`);
             }
           } catch (e) {
             console.warn(`⚠️ Failed to check mobile_app_id for table ${tableName}:`, e);
           }
         }

         // Get sync status information
         try {
           console.log(`Patching table: ${tableName}`);
           //  Get the current sync status from PowerSync
           // This requires access to the PowerSync instance itself, not just the database
           const currentStatus = (database as any).currentStatus;
           if (currentStatus?.lastSyncedAt) {
             console.log(`Last synced at: ${currentStatus.lastSyncedAt}`);
             lastSyncedDate = new Date(currentStatus.lastSyncedAt);
             console.log('Actual Date', lastSyncedDate)
           }
         } catch (error) {
           console.error('Error getting sync information:', error);
         }


          console.log('#####################################################')
          // console.log('PATCH', record)
          console.log('#####################################################')
          console.log('Executing PATCH operation...');
        try {
          // Destructure id from record and keep the rest of the properties
          const { id, ...recordDataToSend } = record;

          //FETCH CURRENT LOCAL RECORD
          const currentRecord = await database.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
          // console.log('currentRecord', currentRecord)

          // Special handling for pre-validated TD lines - always send validation fields
          // Pre-validation is for UX, but backend will still validate
          const isTDLine = tableName === 'receiving_boka_transporter_delivery_note_line';
          const recordData = recordDataToSend as Record<string, any>;
          const isPreValidated = recordData.physical_validation_status === 'validated';
          
          // Special handling for closing delivery notes - always send state field
          const isGrowerDeliveryNote = tableName === 'receiving_grower_delivery_note';
          const isClosingNote = isGrowerDeliveryNote && recordData.state === 'checked';
          
          // Special handling for posting dispatch notes - call API endpoint instead of PATCH
          const isDispatchNote = tableName === 'floor_dispatch_note' || tableName === 'warehouse_dispatch_note';
          const newState = recordData.state;
          const isStateChangeToPosted = isDispatchNote && newState === 'posted';
          
          // Special handling for posting missing receipt notes - call API endpoint instead of PATCH
          const isMissingReceiptNote = tableName === 'warehouse_missing_dnote';
          const isMissingNotePosting = isMissingReceiptNote && newState === 'posted';
          
          // Special handling for stacking operations - detect if warehouse_shipped_bale update is for stacking
          // Only treat as stacking when explicitly flagged (operation_type) or stack_date_time is present.
          // Rack loading (operation_type = 'racked') should NOT be routed to stacking endpoints.
          const operationTypeFlag = recordData.operation_type || (currentRecord as Record<string, any>)?.['operation_type'];
          const isStackingOperation = tableName === 'warehouse_shipped_bale' &&
            (recordData.stack_date_time ||
              operationTypeFlag === 'stacking' ||
              operationTypeFlag === 'reclassified_stacked');

          // Special handling for rack loading (operation_type = 'racked') – route to unified endpoint
          const isRackLoading = tableName === 'warehouse_shipped_bale' && operationTypeFlag === 'racked';
          
          // Special handling for depalletizing (operation_type = 'deracked') – route to unified endpoint
          const isDepalletizing = tableName === 'warehouse_shipped_bale' && operationTypeFlag === 'deracked';
          
          // Special handling for reticketing - detect when barcode is updated with operation_type='reclassified' but grade is NOT updated
          // This distinguishes reticketing from reclassification (which updates grade)
          const isReticketing = tableName === 'warehouse_shipped_bale' && 
            operationTypeFlag === 'reclassified' && 
            recordData.barcode && 
            !recordData.grade &&
            !recordData.location_id &&
            !recordData.stack_date_time;

          // Special handling for ticketing (operation_type = 'ticketed') – route to unified endpoint
          const isTicketing = tableName === 'warehouse_shipped_bale' && operationTypeFlag === 'ticketed';
          
          // Special handling for standalone reclassification operations (not part of stacking)
          // Exclude reticketing (which also uses 'reclassified' but only updates barcode, not grade)
          const operationType = recordData.operation_type || (currentRecord as Record<string, any>)?.['operation_type'];
          const isStandaloneReclassification = tableName === 'warehouse_shipped_bale' && 
            operationType === 'reclassified' && 
            !recordData.location_id && 
            !recordData.stack_date_time &&
            !isReticketing; // Exclude reticketing from reclassification handling
          
          // Special handling for data capturing updates - route to unified endpoint
          const isDataCapturing = tableName === 'warehouse_data_capturing';
          
          // Special handling for receiving operations (warehouse_receiving_scan_bale)
          const isReceivingOperation = tableName === 'warehouse_shipped_bale' && recordData.received === 1;
          const isPalletReceivingOperation = tableName === 'warehouse_pallet' && recordData.location_id !== undefined;
          
          // Special handling for bale updates - server expects all changed fields
          // Include both receiving_bale and warehouse_shipped_bale (for stacking operations)
          // Exclude operations that have their own unified endpoints (stacking, reclassification, rack loading, depalletizing, reticketing, receiving, ticketing)
          const isBale = tableName === 'receiving_bale' || (tableName === 'warehouse_shipped_bale' && !isStackingOperation && !isStandaloneReclassification && !isRackLoading && !isDepalletizing && !isReticketing && !isReceivingOperation && !isTicketing);
          
          // Special handling for receiving_bale updates - detect if scale_barcode, group_number, or lot_number are being updated
          // These should use the receiving_bale_update unified endpoint instead of regular PATCH
          const isReceivingBaleUpdate = tableName === 'receiving_bale' && (
            'scale_barcode' in recordData ||
            'group_number' in recordData ||
            'lot_number' in recordData
          );
          
          let newRecordDataToSend: {[key: string]: any} = {};
          
          // Handle stacking operations - call unified API endpoint instead of PATCH
          if (isStackingOperation) {
            try {
              // Get barcode and warehouse_id from current record (required for unified endpoint)
              const baleRecord = await database.get<any>(`SELECT barcode, warehouse_id FROM warehouse_shipped_bale WHERE id = ?`, [id]);
              
              if (!baleRecord || !baleRecord.barcode) {
                console.warn('⚠️ Cannot sync stacking operation - barcode missing for bale:', id);
                continue; // Skip this operation
              }
              
              const locationId = recordData.location_id || (currentRecord as Record<string, any>)?.['location_id'];
              const warehouseId = baleRecord.warehouse_id || (currentRecord as Record<string, any>)?.['warehouse_id'];
              
              if (!locationId || !warehouseId) {
                console.warn('⚠️ Cannot sync stacking operation - location_id or warehouse_id missing for bale:', id);
                continue; // Skip this operation
              }
              
              // Check if this is a reclassification operation
              const operationType = recordData.operation_type || (currentRecord as Record<string, any>)?.['operation_type'];
              const isReclassification = operationType === 'reclassified_stacked';
              
              // Use appropriate endpoint based on operation type
              const endpointType = isReclassification ? 'warehouse_stack_reclassify_and_assign' : 'warehouse_stack_scan_bale';
              const operationName = isReclassification ? 'reclassifying and stacking' : 'stacking';
              
              console.log(`📤 ${operationName.charAt(0).toUpperCase() + operationName.slice(1)} bale via unified API endpoint:`, { barcode: baleRecord.barcode, warehouse_id: warehouseId, location_id: locationId, endpoint: endpointType });
              
              const stackOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: endpointType,
                    data: {
                      warehouse_id: Number(warehouseId),
                      location_id: Number(locationId),
                      barcode: baleRecord.barcode,
                      ...(mobileUserId && { mobile_user_id: Number(mobileUserId) }),
                      ...(mobileUserName && { mobile_user_name: mobileUserName })
                    }
                  }
                }
              };
              
              const response = await axios.request(stackOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || `Unknown error ${operationName} bale`;
                const warningMessage = `Server rejected ${operationName} operation (bale: ${baleRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: baleRecord.barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Bale ${operationName} successfully:`, serverRecord.result);
                await logToSystem('success', `Bale ${operationName} successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during stacking operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Stacking operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle depalletizing operations (removing bales from racks) - call unified API endpoint instead of PATCH
          if (isDepalletizing) {
            try {
              // Need barcode for the unified endpoint
              const baleRecord = await database.get<any>(
                `SELECT barcode FROM warehouse_shipped_bale WHERE id = ?`,
                [id]
              );

              if (!baleRecord || !baleRecord.barcode) {
                console.warn('⚠️ Cannot sync depalletizing operation - barcode missing for bale:', id);
                continue; // Skip this operation
              }

              console.log('📤 Depalletizing bale via unified API endpoint:', {
                barcode: baleRecord.barcode
              });

              const depalletizeOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_depalletize_scan_bale',
                    data: {
                      barcode: baleRecord.barcode,
                      ...(mobileUserId && { mobile_user_id: Number(mobileUserId) }),
                      ...(mobileUserName && { mobile_user_name: mobileUserName })
                    }
                  }
                }
              };

              const response = await axios.request(depalletizeOptions);
              const serverRecord = response.data;

              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error depalletizing bale';
                const warningMessage = `Server rejected depalletizing operation (bale: ${baleRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: baleRecord.barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Bale removed from rack successfully:`, serverRecord.result);
                await logToSystem('success', `Bale removed from rack successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during depalletizing operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Depalletizing operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle reticketing operations - call unified API endpoint instead of PATCH
          if (isReticketing) {
            try {
              // Get barcode, logistics_barcode, and new barcode from current record and update data
              const baleRecord = await database.get<any>(
                `SELECT barcode, logistics_barcode FROM warehouse_shipped_bale WHERE id = ?`,
                [id]
              );

              if (!baleRecord) {
                console.warn('⚠️ Cannot sync reticketing operation - bale record not found:', id);
                continue; // Skip this operation
              }

              // The new barcode is in recordData.barcode (the updated value)
              const newBarcode = recordData.barcode;
              const logisticsBarcode = baleRecord.logistics_barcode || baleRecord.barcode;

              if (!newBarcode) {
                console.warn('⚠️ Cannot sync reticketing operation - new_barcode missing in update data for bale:', id);
                continue; // Skip this operation
              }

              if (!logisticsBarcode) {
                console.warn('⚠️ Cannot sync reticketing operation - logistics_barcode missing for bale:', id);
                continue; // Skip this operation
              }

              console.log('📤 Reticketing bale via unified API endpoint:', {
                logistics_barcode: logisticsBarcode,
                new_barcode: newBarcode
              });

              const reticketOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_bale_reticket',
                    data: {
                      logistics_barcode: logisticsBarcode,
                      new_barcode: newBarcode,
                      ...(mobileUserId && { mobile_user_id: Number(mobileUserId) }),
                      ...(mobileUserName && { mobile_user_name: mobileUserName })
                    }
                  }
                }
              };

              const response = await axios.request(reticketOptions);
              const serverRecord = response.data;

              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error reticketing bale';
                const warningMessage = `Server rejected reticketing operation (logistics: ${logisticsBarcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, logistics_barcode: logisticsBarcode, new_barcode: newBarcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Bale reticketed successfully:`, serverRecord.result);
                await logToSystem('success', `Bale reticketed successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during reticketing operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Reticketing operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle standalone reclassification operations - call unified API endpoint instead of PATCH
          if (isStandaloneReclassification) {
            try {
              // Get barcode from current record (required for unified endpoint)
              const baleRecord = await database.get<any>(`SELECT barcode FROM warehouse_shipped_bale WHERE id = ?`, [id]);
              
              if (!baleRecord || !baleRecord.barcode) {
                console.warn('⚠️ Cannot sync reclassification operation - barcode missing for bale:', id);
                continue; // Skip this operation
              }
              
              // Get the new grade from the update or from the current record if not changed in this specific op
              const newGradeId = recordData.grade || (currentRecord as any)?.grade;
              
              if (!newGradeId) {
                console.warn('⚠️ Cannot sync reclassification operation - grade_id missing for bale:', id);
                continue; // Skip this operation
              }
              
              console.log(`📤 Reclassifying bale via unified API endpoint:`, { barcode: baleRecord.barcode, grade_id: newGradeId });
              
              const reclassifyOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_reclassify_scan_bale',
                    data: {
                      barcode: baleRecord.barcode,
                      grade_id: Number(newGradeId)
                    }
                  }
                }
              };
              
              const response = await axios.request(reclassifyOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error reclassifying bale';
                const warningMessage = `Server rejected reclassification operation (bale: ${baleRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: baleRecord.barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Bale reclassified successfully:`, serverRecord.result);
                await logToSystem('success', `Bale reclassified successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during reclassification operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Reclassification operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }

          // Handle ticketing operations - call unified API endpoint instead of PATCH
          if (isTicketing) {
            try {
              // Get barcode from current record (required for search in wizard)
              const baleRecord = await database.get<any>(`SELECT barcode FROM warehouse_shipped_bale WHERE id = ?`, [id]);
              
              if (!baleRecord || !baleRecord.barcode) {
                console.warn('⚠️ Cannot sync ticketing operation - barcode missing for bale:', id);
                continue; // Skip this operation
              }
              
              // Get the new logistics barcode from the update
              const newLogisticsBarcode = recordData.logistics_barcode;
              
              if (!newLogisticsBarcode) {
                console.warn('⚠️ Cannot sync ticketing operation - new_logistics_barcode missing in update data for bale:', id);
                continue; // Skip this operation
              }
              
              console.log(`📤 Updating ticketing for bale via unified API endpoint:`, { barcode: baleRecord.barcode, new_logistics_barcode: newLogisticsBarcode });
              
              const ticketingOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_ticketing_update_barcode',
                    data: {
                      barcode: baleRecord.barcode,
                      new_logistics_barcode: newLogisticsBarcode
                    }
                  }
                }
              };
              
              const response = await axios.request(ticketingOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error updating ticketing';
                const warningMessage = `Server rejected ticketing operation (bale: ${baleRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: baleRecord.barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Ticketing updated successfully:`, serverRecord.result);
                await logToSystem('success', `Ticketing updated successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during ticketing operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Ticketing operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle posting dispatch note - call API endpoint instead of regular PATCH
          if (isStateChangeToPosted) {
            // Declare at outer scope for catch block access
            const postType = tableName === 'warehouse_dispatch_note' 
              ? 'warehouse_dispatch_post_note' 
              : 'floor_dispatch_post_note';
            try {
              console.log('📤 Posting dispatch note via API endpoint:', id);
              
              const postOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: postType,
                    data: {
                      dispatch_note_id: id
                    }
                  }
                }
              };
              
              const response = await axios.request(postOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error posting dispatch note';
                // For record operations, treat server errors as handled (complete transaction, no retry)
                const warningMessage = `Server rejected dispatch note posting (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, postType, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log('✅ Dispatch note posted successfully:', serverRecord.result);
                await logToSystem('success', `Dispatch note posted successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during dispatch note posting (id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Post dispatch note request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage, postType });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle posting missing receipt note - call API endpoint instead of regular PATCH
          if (isMissingNotePosting) {
            try {
              console.log('📤 Posting missing receipt note via API endpoint:', id);
              
              const postOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_missing_dnote_post',
                    data: {
                      missing_dnote_id: id
                    }
                  }
                }
              };
              
              const response = await axios.request(postOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error posting missing receipt note';
                // For record operations, treat server errors as handled (complete transaction, no retry)
                const warningMessage = `Server rejected missing receipt note posting (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log('✅ Missing receipt note posted successfully:', serverRecord.result);
                await logToSystem('success', `Missing receipt note posted successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during missing receipt note posting (id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Post missing receipt note request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle receiving_bale updates (scale_barcode, group_number, lot_number) via unified endpoint
          if (isReceivingBaleUpdate) {
            try {
              // Get bale_id from the record
              const baleId = parseInt(id);
              
              if (!baleId) {
                console.warn('⚠️ Cannot sync receiving_bale update - bale_id missing:', id);
                continue; // Skip this operation
              }
              
              // Prepare data for unified endpoint (only include the fields being updated)
              const updateData: any = {
                bale_id: baleId,
              };
              
              // Include only the fields that are being updated
              if ('scale_barcode' in recordData) {
                updateData.scale_barcode = recordData.scale_barcode;
              }
              if ('group_number' in recordData) {
                updateData.group_number = recordData.group_number;
              }
              if ('lot_number' in recordData) {
                updateData.lot_number = recordData.lot_number;
              }
              
              console.log(`📤 Updating receiving_bale via unified API endpoint:`, { bale_id: baleId, updateData });
              
              const updateOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'receiving_bale_update',
                    data: updateData
                  }
                }
              };
              
              const response = await axios.request(updateOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error updating bale';
                const warningMessage = `Server rejected bale update (bale_id: ${baleId}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, bale_id: baleId, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log('✅ Bale updated successfully:', serverRecord.result);
                await logToSystem('success', `Bale updated successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during bale update (id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Bale update request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }

          // Handle pallet receiving operations (moving a pallet to a location) - call unified API endpoint instead of regular PATCH
          if (isPalletReceivingOperation) {
            try {
              // Need barcode and warehouse_id for the unified endpoint
              const palletRecord = await database.get<any>(
                `SELECT barcode, warehouse_id FROM warehouse_pallet WHERE id = ? OR mobile_app_id = ?`,
                [id, id]
              );

              if (!palletRecord || !palletRecord.barcode) {
                console.warn('⚠️ Cannot sync pallet receiving operation - barcode missing for pallet:', id);
                continue; // Skip this operation
              }

              const locationId = recordData.location_id || (currentRecord as Record<string, any>)?.['location_id'];
              const warehouseId = palletRecord.warehouse_id || (currentRecord as Record<string, any>)?.['warehouse_id'];

              console.log('📤 Receiving pallet via unified API endpoint:', {
                barcode: palletRecord.barcode,
                warehouse_id: warehouseId,
                location_id: locationId
              });

              const palletOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_pallet_scan_rack',
                    data: {
                      warehouse_id: Number(warehouseId),
                      location_id: Number(locationId),
                      pallet_barcode: palletRecord.barcode,
                      ...(mobileUserId && { mobile_user_id: Number(mobileUserId) }),
                      ...(mobileUserName && { mobile_user_name: mobileUserName })
                    }
                  }
                }
              };

              const response = await axios.request(palletOptions);
              const serverRecord = response.data;

              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error receiving pallet';
                const warningMessage = `Server rejected pallet receiving (barcode: ${palletRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: palletRecord.barcode, serverResponse: serverRecord.result });
                continue; 
              } else {
                console.log(`✅ Pallet received successfully:`, serverRecord.result);
                await logToSystem('success', `Pallet received successfully.`, op, serverRecord.result);
                continue; 
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              if (isNetworkError(error)) {
                console.error(`❌ Network error during pallet receiving (pallet id: ${id}): ${errorMessage}. Will retry.`);
                throw error; 
              }
              const warningMessage = `Pallet receiving request failed (pallet id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              continue; 
            }
          }
          
          // Handle data capturing updates via unified endpoint
          if (isDataCapturing) {
            try {
              // Get barcode from current record (required for unified endpoint)
              const barcode = (currentRecord as Record<string, any>)?.['barcode'];
              
              if (!barcode) {
                console.warn('⚠️ Cannot sync data capturing update - barcode missing for record:', id);
                continue; // Skip this operation
              }
              
              // Prepare data for unified endpoint (only include changed fields)
              const updateData: any = {
                barcode: barcode,
              };
              
              // Include only fields that are being updated
              if ('mass' in recordData) updateData.mass = recordData.mass;
              if ('price' in recordData) updateData.price = recordData.price;
              if ('grade' in recordData) updateData.grade = recordData.grade;
              if ('operation_no' in recordData) updateData.operation_no = recordData.operation_no;
              if ('tobacco_type' in recordData) updateData.tobacco_type = recordData.tobacco_type;
              if ('pickings_weight' in recordData) updateData.pickings_weight = recordData.pickings_weight;
              if ('amount' in recordData) updateData.amount = recordData.amount;
              if ('product_id' in recordData) updateData.product_id = recordData.product_id;
              
              console.log(`📤 Updating data capturing record via unified API endpoint:`, { barcode, updateData });
              
              const updateOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_data_capturing_save',
                    data: updateData
                  }
                }
              };
              
              const response = await axios.request(updateOptions);
              const serverRecord = response.data;
              
              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error updating data capturing record';
                const warningMessage = `Server rejected data capturing update (barcode: ${barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log('✅ Data capturing record updated successfully:', serverRecord.result);
                await logToSystem('success', `Data capturing record updated successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during data capturing update (id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Data capturing update request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }
          
          // Handle receiving operations via unified endpoint
          if (isReceivingOperation) {
            try {
              // Get required fields from current record or update data
              const barcode = recordData.barcode || (currentRecord as Record<string, any>)?.['barcode'];
              const warehouseId = recordData.warehouse_id || (currentRecord as Record<string, any>)?.['warehouse_id'];
              const locationId = recordData.location_id || (currentRecord as Record<string, any>)?.['location_id'];
              const receivedMass = recordData.received_mass;
              const logisticsBarcode = recordData.logistics_barcode;

              if (!barcode || !warehouseId || !locationId) {
                console.warn('⚠️ Cannot sync receiving operation - missing required fields:', { id, barcode, warehouseId, locationId });
                // Fall back to regular PATCH if fields are missing
              } else {
                console.log(`📤 Receiving bale via unified API endpoint:`, { barcode, warehouse_id: warehouseId, location_id: locationId });

                const receiveOptions = {
                  method: 'POST',
                  url: `${normalizedServerURL}/api/fo/create_unified`,
                  headers: {
                    'Content-Type': 'application/json',
                    'X-FO-TOKEN': token
                  },
                  data: {
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      type: 'warehouse_receiving_scan_bale',
                      data: {
                        warehouse_id: Number(warehouseId),
                        location_id: Number(locationId),
                        receiving_mode: 'by_bale',
                        barcode: barcode,
                        logistics_barcode: logisticsBarcode || undefined,
                        received_mass: receivedMass ? Number(receivedMass) : undefined,
                      }
                    }
                  }
                };

                const response = await axios.request(receiveOptions);
                const serverRecord = response.data;

                if (serverRecord?.result && serverRecord.result.success === false) {
                  const errorMessage = serverRecord.result.message || 'Unknown error receiving bale';
                  const warningMessage = `Server rejected receiving operation (barcode: ${barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                  console.warn(`⚠️ ${warningMessage}`);
                  await logToSystem('warning', warningMessage, op, { errorMessage, barcode, serverResponse: serverRecord.result });
                  continue; // Skip the regular PATCH operation
                } else {
                  console.log('✅ Bale received successfully via unified endpoint:', serverRecord.result);
                  await logToSystem('success', `Bale received successfully.`, op, serverRecord.result);
                  continue; // Skip the regular PATCH operation
                }
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              if (isNetworkError(error)) {
                console.error(`❌ Network error during receiving operation (id: ${id}): ${errorMessage}. Will retry.`);
                throw error;
              }
              const warningMessage = `Receiving operation request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              continue; // Skip the regular PATCH operation
            }
          }

          // Handle pallet receiving operations via unified endpoint
          if (isPalletReceivingOperation) {
            try {
              const barcode = recordData.barcode || (currentRecord as Record<string, any>)?.['barcode'];
              const warehouseId = recordData.warehouse_id || (currentRecord as Record<string, any>)?.['warehouse_id'];
              const locationId = recordData.location_id || (currentRecord as Record<string, any>)?.['location_id'];

              if (!barcode || !warehouseId || !locationId) {
                console.warn('⚠️ Cannot sync pallet receiving operation - missing required fields:', { id, barcode, warehouseId, locationId });
              } else {
                console.log(`📤 Receiving pallet via unified API endpoint:`, { barcode, warehouse_id: warehouseId, location_id: locationId });

                const receiveOptions = {
                  method: 'POST',
                  url: `${normalizedServerURL}/api/fo/create_unified`,
                  headers: {
                    'Content-Type': 'application/json',
                    'X-FO-TOKEN': token
                  },
                  data: {
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      type: 'warehouse_receiving_scan_bale',
                      data: {
                        warehouse_id: Number(warehouseId),
                        location_id: Number(locationId),
                        receiving_mode: 'by_pallet',
                        barcode: barcode,
                      }
                    }
                  }
                };

                const response = await axios.request(receiveOptions);
                const serverRecord = response.data;

                if (serverRecord?.result && serverRecord.result.success === false) {
                  const errorMessage = serverRecord.result.message || 'Unknown error receiving pallet';
                  const warningMessage = `Server rejected pallet receiving operation (barcode: ${barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                  console.warn(`⚠️ ${warningMessage}`);
                  await logToSystem('warning', warningMessage, op, { errorMessage, barcode, serverResponse: serverRecord.result });
                  continue; // Skip the regular PATCH operation
                } else {
                  console.log('✅ Pallet received successfully via unified endpoint:', serverRecord.result);
                  await logToSystem('success', `Pallet received successfully.`, op, serverRecord.result);
                  continue; // Skip the regular PATCH operation
                }
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              if (isNetworkError(error)) {
                console.error(`❌ Network error during pallet receiving operation (id: ${id}): ${errorMessage}. Will retry.`);
                throw error;
              }
              const warningMessage = `Pallet receiving operation request failed (id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              continue; // Skip the regular PATCH operation
            }
          }
          
          if (isTDLine && isPreValidated) {
            // For pre-validated TD lines, always send validation fields to backend
            // Backend will run its validation logic
            const validationFields = [
              'actual_bales_found',
              'validation_notes', 
              'bales_difference',
              'physical_validation_status'
            ];
            
            // Get actual_bales_found from recordData or currentRecord
            let actualBalesFound = recordData['actual_bales_found'];
            if (actualBalesFound == null && currentRecord) {
              actualBalesFound = (currentRecord as Record<string, any>)['actual_bales_found'];
            }
            
            // Ensure actual_bales_found is present and valid (must be a positive integer)
            if (actualBalesFound == null || actualBalesFound === undefined) {
              console.warn('⚠️ actual_bales_found is missing, skipping TD line update');
              throw new Error('actual_bales_found is required for TD line validation');
            }
            
            // Convert to integer
            const numValue = typeof actualBalesFound === 'string' ? parseInt(actualBalesFound, 10) : Number(actualBalesFound);
            if (isNaN(numValue) || numValue <= 0) {
              console.warn('⚠️ actual_bales_found must be a positive number, got:', actualBalesFound);
              throw new Error(`actual_bales_found must be a positive number, got: ${actualBalesFound}`);
            }
            
            for (const field of validationFields) {
              if (field in recordData) {
                let value = recordData[field];
                // Use the validated actual_bales_found
                if (field === 'actual_bales_found') {
                  value = numValue;
                }
                newRecordDataToSend[field] = value;
              } else if (field === 'actual_bales_found') {
                // Include actual_bales_found even if not in recordData (use from currentRecord)
                newRecordDataToSend[field] = numValue;
              }
            }
            
            // Always include has_been_printed and state if they're in the update (for print status)
            if ('has_been_printed' in recordData) {
              newRecordDataToSend['has_been_printed'] = recordData['has_been_printed'];
            }
            if ('state' in recordData) {
              newRecordDataToSend['state'] = recordData['state'];
            }
            
            console.log('Pre-validated TD line - sending validation fields for backend validation:', newRecordDataToSend);
          } else if (isClosingNote) {
            // For closing delivery notes, always send state field to trigger close logic
            newRecordDataToSend['state'] = recordData.state;
            console.log('Closing delivery note - sending state field:', newRecordDataToSend);
          } else if (isBale) {
            // For bale updates, send all changed fields (server will process via update_data_capturing_details)
            console.log('🔍 Bale update - recordDataToSend:', recordDataToSend);
            console.log('🔍 Bale update - currentRecord:', currentRecord);
            
            // Fields that should be excluded from bale updates (server-managed or not relevant)
            const excludeFields = ['write_date', 'create_date', 'id', 'table_name'];
            
            // Fields that should always be included if present (even if unchanged)
            // These are fields that the server needs to process
            const alwaysIncludeFields = ['timb_grade', 'buyer', 'buyer_grade', 'price', 'salecode_id', 
                                        'buying_staff_hr_id', 'checking_staff_hr_id', 'is_released', 'hessian',
                                        'lot_number', 'group_number','curverid_classifier_number','curverid_buyer_number',
                                        'location_id', 'stack_date_time', 'operation_type', 'grade', 'stacked_by'];
            
            // First, check if is_released is in the current record but not in recordDataToSend
            // This handles the case where is_released was set locally but PowerSync didn't include it in the transaction
            const currentIsReleased = (currentRecord as Record<string, any>)?.['is_released'];
            const recordDataToSendTyped = recordDataToSend as Record<string, any>;
            if (currentIsReleased !== null && currentIsReleased !== undefined && !('is_released' in recordDataToSendTyped)) {
              // If is_released is set in the current record, include it in the update
              recordDataToSendTyped['is_released'] = currentIsReleased;
              console.log(`  ✅ Including is_released from current record: ${currentIsReleased}`);
            }
            
            // Special handling for price=0 - ensure it's always included if set to 0
            // This handles the case where price=0 was set locally but PowerSync didn't include it in the transaction
            const currentPrice = (currentRecord as Record<string, any>)?.['price'];
            if (currentPrice === 0 && !('price' in recordDataToSendTyped)) {
              recordDataToSendTyped['price'] = 0;
              console.log(`  ✅ Including price=0 from current record (was missing from transaction)`);
            }

            // Special handling for stacking fields - ensure they're always included if set
            // This handles the case where stacking fields were set locally but PowerSync didn't include them in the transaction
            const stackingFields = ['location_id', 'stack_date_time', 'operation_type', 'grade', 'stacked_by'];
            for (const field of stackingFields) {
              const currentValue = (currentRecord as Record<string, any>)?.[field];
              if (currentValue !== null && currentValue !== undefined && !(field in recordDataToSendTyped)) {
                recordDataToSendTyped[field] = currentValue;
                console.log(`  ✅ Including ${field} from current record (was missing from transaction): ${currentValue}`);
              }
            }
            
            for (const [key, value] of Object.entries(recordDataToSendTyped)) {
              // Exclude has_been_printed for floor_dispatch_note (local-only field, not in Odoo)
              if (isDispatchNote && key === 'has_been_printed') {
                console.log(`  ⏭️ Skipping local-only field has_been_printed for floor_dispatch_note`);
                continue;
              }
              
              // Skip excluded fields (metadata, timestamps, etc.)
              if (excludeFields.includes(key)) {
                console.log(`  ⏭️ Skipping excluded field: ${key}`);
                continue;
              }
              
              // Always include important fields that the server needs to process (even if null/undefined)
              if (alwaysIncludeFields.includes(key)) {
                // For is_released, always include it if it's set (even if it appears unchanged)
                if (key === 'is_released') {
                  const currentValue = (currentRecord as Record<string, any>)?.[key];
                  // Include if value is truthy (1, true) or if it's explicitly being set
                  if (value === 1 || value === true || value === '1' || value === 'true') {
                    newRecordDataToSend[key] = value;
                    console.log(`  ✅ Including is_released: ${value} (current: ${currentValue})`);
                    continue;
                  } else if (value !== null && value !== undefined) {
                    newRecordDataToSend[key] = value;
                    console.log(`  ✅ Including is_released: ${value}`);
                    continue;
                  }
                } else if (key === 'price') {
                  // Special handling for price - always include if it's 0 (for rejected bales)
                  const currentValue = (currentRecord as Record<string, any>)?.[key];
                  if (value === 0 || value === '0') {
                    // Always include price=0, even if current value is also 0 (explicit update)
                    newRecordDataToSend[key] = typeof value === 'string' ? 0 : value;
                    console.log(`  ✅ Including price=0 (explicit zero value, current: ${currentValue})`);
                    continue;
                  } else if (value !== null && value !== undefined) {
                    newRecordDataToSend[key] = value;
                    console.log(`  ✅ Including price: ${value} (current: ${currentValue})`);
                    continue;
                  } else {
                    // Skip null/undefined price unless current is also null/undefined (no change)
                    if (currentValue === null || currentValue === undefined) {
                      console.log(`  ⏭️ Skipping null/undefined price (no change)`);
                      continue;
                    }
                    newRecordDataToSend[key] = value;
                    console.log(`  ✅ Including price: ${value} (nullifying current: ${currentValue})`);
                    continue;
                  }
                } else if (key === 'location_id' || key === 'stack_date_time' || key === 'operation_type' || key === 'grade' || key === 'stacked_by') {
                  // Special handling for stacking fields - always include if present (even if appears unchanged)
                  const currentValue = (currentRecord as Record<string, any>)?.[key];
                  if (value !== null && value !== undefined) {
                    newRecordDataToSend[key] = value;
                    console.log(`  ✅ Including stacking field: ${key} = ${value} (current: ${currentValue})`);
                    continue;
                  } else if (currentValue !== null && currentValue !== undefined) {
                    // Include from current record if value is null/undefined but current has a value
                    newRecordDataToSend[key] = currentValue;
                    console.log(`  ✅ Including stacking field from current record: ${key} = ${currentValue}`);
                    continue;
                  }
                } else {
                  // For other always-include fields, skip null/undefined unless explicitly set
                  if (value === null || value === undefined) {
                    const currentValue = (currentRecord as Record<string, any>)?.[key];
                    if (currentValue === null || currentValue === undefined) {
                      console.log(`  ⏭️ Skipping null/undefined field: ${key}`);
                      continue;
                    }
                  }
                  newRecordDataToSend[key] = value;
                  console.log(`  ✅ Including important field: ${key} = ${value}`);
                  continue;
                }
              }
              
              // Skip null/undefined values unless they're explicitly being set to null
              if (value === null || value === undefined) {
                // Only include null if the current value is not null (explicit nullification)
                const currentValue = (currentRecord as Record<string, any>)?.[key];
                if (currentValue === null || currentValue === undefined) {
                  console.log(`  ⏭️ Skipping null/undefined field: ${key}`);
                  continue;
                }
              }
              
              // For inventory bale tables, trust the record data from PowerSync and include it
              const isInventoryBale = tableName === 'warehouse_shipped_bale' || tableName === 'receiving_bale';
              if (isInventoryBale && !(excludeFields.includes(key))) {
                newRecordDataToSend[key] = value;
                console.log(`  ✅ Including bale field from PowerSync record: ${key} = ${value}`);
                continue;
              }
              
              // Only include fields that have changed (or are new)
              const currentValue = (currentRecord as Record<string, any>)?.[key];
              
              // Compare values - handle null/undefined properly
              // Use JSON.stringify for deep comparison of objects/arrays, otherwise use strict equality
              let valueChanged = false;
              if (typeof value === 'object' && typeof currentValue === 'object' && value !== null && currentValue !== null) {
                valueChanged = JSON.stringify(value) !== JSON.stringify(currentValue);
              } else {
                // Handle null/undefined comparison
                if (value === null || value === undefined) {
                  valueChanged = currentValue !== null && currentValue !== undefined;
                } else if (currentValue === null || currentValue === undefined) {
                  valueChanged = true;
                } else {
                  valueChanged = value !== currentValue;
                }
              }
              
              if (valueChanged) {
                newRecordDataToSend[key] = value;
                console.log(`  ✅ Including changed field: ${key} = ${value} (was: ${currentValue})`);
              } else {
                console.log(`  ⏭️ Skipping unchanged field: ${key} = ${value}`);
              }
            }
            
            // Validate that we have data to send
            if (Object.keys(newRecordDataToSend).length === 0) {
              console.warn('⚠️ No changed fields found for bale update - skipping');
              console.warn('⚠️ recordDataToSend keys:', Object.keys(recordDataToSend));
              console.warn('⚠️ currentRecord keys:', currentRecord ? Object.keys(currentRecord) : 'null');
              console.warn('⚠️ recordDataToSend values:', recordDataToSend);
              console.warn('⚠️ currentRecord values:', currentRecord);
              continue; // Skip this operation if no changes
            }
            
            console.log('📤 Bale update - sending changed fields:', newRecordDataToSend);
            console.log('📤 Bale update - changed fields count:', Object.keys(newRecordDataToSend).length);
          } else {
            // For other records, compare against current local record to find changes
            // Special handling for TD lines - ensure has_been_printed and state are included if present
            if (isTDLine) {
              // For TD lines, always include has_been_printed and state if they're in the update
              if ('has_been_printed' in recordData) {
                newRecordDataToSend['has_been_printed'] = recordData['has_been_printed'];
                console.log(`  ✅ Including has_been_printed for TD line: ${recordData['has_been_printed']}`);
              }
              if ('state' in recordData) {
                newRecordDataToSend['state'] = recordData['state'];
                console.log(`  ✅ Including state for TD line: ${recordData['state']}`);
              }
            }
            
            for (const [key, value] of Object.entries(recordDataToSend as Record<string, any>)) {
              // Skip if already added for TD lines
              if (isTDLine && (key === 'has_been_printed' || key === 'state')) {
                continue;
              }
              
              // Map instruction_id to shipping_instruction_id for warehouse_dispatch_note
              if (tableName === 'warehouse_dispatch_note' && key === 'instruction_id') {
                newRecordDataToSend['shipping_instruction_id'] = value;
                console.log(`  ✅ Mapped instruction_id to shipping_instruction_id: ${value}`);
                continue;
              }
              
              // For inventory tables, trust the record data from PowerSync and include it
              const isInventoryTable = tableName.startsWith('warehouse_') || tableName.startsWith('floor_dispatch_');
              if (isInventoryTable) {
                newRecordDataToSend[key] = value;
                console.log(`  ✅ Including field from PowerSync record: ${key} = ${value}`);
                continue;
              }
              
              // For other tables, only include fields that have changed (or are new)
              const currentValue = (currentRecord as Record<string, any>)?.[key];
              // Use loose comparison to handle type mismatches (1 vs true, etc.)
              if (value != currentValue) {
                newRecordDataToSend[key] = value;
                console.log(`  ✅ Including changed field: ${key} = ${value} (was: ${currentValue})`);
              } else {
                console.log(`  ⏭️ Skipping unchanged field: ${key} = ${value}`);
              }
            }
          }

          // Resolve UUIDs for warehouse_dispatch_note many-to-one fields
          if (tableName === 'warehouse_dispatch_note') {
            const m2oFields = ['driver_id', 'transport_id'];
            let resolutionFailed = false;
            for (const field of m2oFields) {
              const val = newRecordDataToSend[field];
              if (val && typeof val === 'string' && val.includes('-')) {
                // It's a UUID, resolve to Odoo ID
                const relatedTable = field === 'driver_id' ? 'warehouse_driver' : 'warehouse_transport';
                console.log(`🔍 Resolving UUID for ${field} (${val}) in table ${relatedTable}`);
                
                // Try to find by id (for unsynced) or mobile_app_id (for synced)
                const relatedRecord = await database.getOptional<any>(
                  `SELECT id FROM ${relatedTable} WHERE id = ? OR mobile_app_id = ? LIMIT 1`,
                  [val, val]
                );
                
                if (relatedRecord && relatedRecord.id && !isNaN(Number(relatedRecord.id))) {
                  newRecordDataToSend[field] = Number(relatedRecord.id);
                  console.log(`✅ Resolved ${field} UUID ${val} to Odoo ID: ${newRecordDataToSend[field]}`);
                } else if (relatedRecord && relatedRecord.id) {
                  // It's still a UUID locally, but we found the record
                  console.log(`ℹ️ Found local record for ${field} (${val}), but it's still a UUID. Sending as-is.`);
                  newRecordDataToSend[field] = val;
                } else {
                  // If not found at all, send as-is and hope the server handles it
                  console.warn(`⚠️ ${field} UUID ${val} not found in local ${relatedTable}. Sending as-is.`);
                  newRecordDataToSend[field] = val;
                }
              }
            }
            if (resolutionFailed) continue; // Skip this PATCH and let it retry later

            // Filter out non-Odoo fields for warehouse_dispatch_note
            // driver_name, driver_national_id, driver_cellphone are related fields or local-only
            const fieldsToRemove = ['driver_name', 'driver_national_id', 'driver_cellphone'];
            fieldsToRemove.forEach(f => {
              if (f in newRecordDataToSend) {
                console.log(`  🗑️ Removing non-Odoo field from warehouse_dispatch_note PATCH: ${f}`);
                delete newRecordDataToSend[f];
              }
            });
          }

          // Handle rack loading operations - call unified API endpoint instead of PATCH
          if (isRackLoading) {
            try {
              // Need barcode, pallet_id, warehouse_id, location_id, received_mass (optional)
              const baleRecord = await database.get<any>(
                `SELECT barcode, warehouse_id, location_id, pallet_id, received_mass FROM warehouse_shipped_bale WHERE id = ?`,
                [id]
              );

              if (!baleRecord || !baleRecord.barcode) {
                console.warn('⚠️ Cannot sync rack loading operation - barcode missing for bale:', id);
                continue; // Skip this operation
              }

              let palletId = recordData.pallet_id || (currentRecord as Record<string, any>)?.['pallet_id'] || baleRecord.pallet_id;
              const warehouseIdVal = recordData.warehouse_id || (currentRecord as Record<string, any>)?.['warehouse_id'] || baleRecord.warehouse_id;
              const locationIdVal = recordData.location_id || (currentRecord as Record<string, any>)?.['location_id'] || baleRecord.location_id;
              const receivedMassVal = recordData.received_mass || baleRecord.received_mass || null;

              if (!palletId || !warehouseIdVal || !locationIdVal) {
                console.warn('⚠️ Cannot sync rack loading operation - pallet_id/warehouse_id/location_id missing for bale:', id);
                continue; // Skip this operation
              }

              // Resolve pallet_id if it's a UUID to the actual Odoo ID
              const palletIdStr = String(palletId);
              const isUUID = palletIdStr.includes('-') || isNaN(Number(palletId));
              
              if (isUUID) {
                // It's a UUID - try to resolve to Odoo ID
                console.log(`🔍 Resolving UUID for pallet_id (${palletIdStr})`);
                
                // Try to find by id (for unsynced) or mobile_app_id (for synced)
                const relatedRecord = await database.getOptional<any>(
                  `SELECT id FROM warehouse_pallet WHERE id = ? OR mobile_app_id = ? LIMIT 1`,
                  [palletIdStr, palletIdStr]
                );
                
                if (relatedRecord && relatedRecord.id && !isNaN(Number(relatedRecord.id))) {
                  palletId = Number(relatedRecord.id);
                  console.log(`✅ Resolved pallet UUID ${palletIdStr} to Odoo ID: ${palletId}`);
                } else {
                  // Resort to mobile id - send the UUID as-is
                  // The Odoo controller pallet_scan_bale has been updated to resolve UUIDs using mobile_app_id
                  console.log(`ℹ️ Pallet UUID ${palletIdStr} not resolved to Odoo ID yet. Sending as-is.`);
                  palletId = palletIdStr;
                }
              }
              
              // Verify it exists if it was already a number
              if (typeof palletId === 'number' || !isNaN(Number(palletId))) {
                const palletIdNum = Number(palletId);
                const palletExists = await database.getOptional<any>(
                  `SELECT id FROM warehouse_pallet WHERE id = ? LIMIT 1`,
                  [palletIdNum]
                );
                
                if (!palletExists) {
                  console.warn(`⚠️ Pallet with ID ${palletIdNum} not found in local database.`);
                  // continue; // Still send it, maybe it synced but we don't have it yet
                }
              }

              console.log('📤 Rack loading bale via unified API endpoint:', {
                barcode: baleRecord.barcode,
                pallet_id: palletId,
                warehouse_id: warehouseIdVal,
                location_id: locationIdVal
              });

              const rackLoadOptions = {
                method: 'POST',
                url: `${normalizedServerURL}/api/fo/create_unified`,
                headers: {
                  'Content-Type': 'application/json',
                  'X-FO-TOKEN': token
                },
                data: {
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    type: 'warehouse_pallet_scan_bale',
                    data: {
                      barcode: baleRecord.barcode,
                      pallet_id: palletId,
                      warehouse_id: Number(warehouseIdVal),
                      location_id: Number(locationIdVal),
                      ...(receivedMassVal !== null ? { received_mass: receivedMassVal } : {}),
                      ...(mobileUserId && { mobile_user_id: Number(mobileUserId) }),
                      ...(mobileUserName && { mobile_user_name: mobileUserName })
                    }
                  }
                }
              };

              const response = await axios.request(rackLoadOptions);
              const serverRecord = response.data;

              if (serverRecord?.result && serverRecord.result.success === false) {
                const errorMessage = serverRecord.result.message || 'Unknown error loading bale to rack';
                const warningMessage = `Server rejected rack loading operation (bale: ${baleRecord.barcode}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
                console.warn(`⚠️ ${warningMessage}`);
                await logToSystem('warning', warningMessage, op, { errorMessage, barcode: baleRecord.barcode, serverResponse: serverRecord.result });
                // Do NOT throw here – this lets the transaction complete and drops the op
                continue; // Skip the regular PATCH operation
              } else {
                console.log(`✅ Bale loaded to rack successfully:`, serverRecord.result);
                await logToSystem('success', `Bale loaded to rack successfully.`, op, serverRecord.result);
                // Skip the regular PATCH operation since we handled it via the API endpoint
                continue;
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error';
              
              // Network errors should be retried
              if (isNetworkError(error)) {
                console.error(`❌ Network error during rack loading operation (bale id: ${id}): ${errorMessage}. Will retry.`);
                throw error; // Re-throw to trigger PowerSync retry
              }
              
              // For other errors, treat as handled (complete transaction, no retry)
              const warningMessage = `Rack loading operation request failed (bale id: ${id}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
              console.warn(`⚠️ ${warningMessage}`);
              await logToSystem('warning', warningMessage, op, { error: errorMessage });
              // Do NOT throw here – this lets the transaction complete and drops the op
              continue; // Skip the regular PATCH operation
            }
          }

          // Only include mobile user info for models that have these fields (whitelist)
          const tablesWithMobileUserFields = ['receiving_grower_delivery_note', 'floor_dispatch_note', 'warehouse_dispatch_note'];
          if (tablesWithMobileUserFields.includes(tableName)) {
            if (mobileUserId) {
              newRecordDataToSend['mobile_user_id'] = Number(mobileUserId);
            }
            if (mobileUserName) {
              newRecordDataToSend['mobile_user_name'] = mobileUserName;
            }
          }

          // Filter out columns that should not be synced to server
          const columnsToIgnore = ['mobile_grower_image', 'mobile_grower_national_id_image', 'write_date', 'create_date'];
          columnsToIgnore.forEach(column => {
            if (column in newRecordDataToSend) {
              delete newRecordDataToSend[column];
              console.log('skipping column', column)
            }
          });

          // Remove table_name from update payload (it's in the URL query string)
          delete newRecordDataToSend['table_name'];
          
          // For bale updates, ensure stacking fields are included from current record if missing
          if (isBale && currentRecord) {
            const stackingFields = ['location_id', 'stack_date_time', 'operation_type', 'grade', 'stacked_by'];
            for (const field of stackingFields) {
              const currentValue = (currentRecord as Record<string, any>)?.[field];
              // Include if current record has a value and it's not already in payload
              if (currentValue !== null && currentValue !== undefined && !(field in newRecordDataToSend)) {
                newRecordDataToSend[field] = currentValue;
                console.log(`  ✅ Adding stacking field ${field} from current record: ${currentValue}`);
              }
            }
          }

          console.log('📋 Final payload after filtering:', newRecordDataToSend);
          console.log('📋 Payload keys count:', Object.keys(newRecordDataToSend).length);

          // ADD LAST SYNCED DATE TO NEW RECORD DATA TO SEND
          // newRecordDataToSend['last_synced_date'] = lastSyncedDate

          // SET TABLE NAME TO ODOO DB NAME SCHEME
          // odooTableName already declared at outer scope
          
          // Special handling for different table name patterns
          if (tableName.includes('receiving_boka_')) {
            // receiving_boka_transporter_delivery_note_line -> receiving_boka.transporter_delivery_note_line
            odooTableName = tableName.replace('receiving_boka_', 'receiving_boka.')
          } else if (tableName.includes('floor_dispatch_')) {
            // floor_dispatch_note -> floor_dispatch.note
            odooTableName = tableName.replace('floor_dispatch_', 'floor_dispatch.')
          } else if (tableName === 'receiving_grower_delivery_note') {
            // receiving_grower_delivery_note -> receiving.grower_delivery_note
            odooTableName = 'receiving.grower_delivery_note'
          } else if (tableName.startsWith('receiving_')) {
            // receiving_bale, receiving_transporter_delivery_note, etc. -> receiving.bale, receiving.transporter_delivery_note
            odooTableName = tableName.replace('receiving_', 'receiving.')
          } else if (tableName.startsWith('warehouse_')) {
            // warehouse_dispatch_note -> warehouse.dispatch_note
            odooTableName = tableName.replace('warehouse_', 'warehouse.')
          } else {
            // For other tables, use odoo_gms prefix
            odooTableName = 'odoo_gms.' + tableName
          }

          // ADDING 1 MINUTES TO LAST SYNC TIME
          const newLastSyncedDate = new Date(lastSyncedDate.getTime() + 1 * 60 * 1000).toISOString();
          console.log('newLastSyncedDate', newLastSyncedDate)

          // Configure the request - for JSON type endpoint, include table_name in params
          const patchOptions = {
            method: 'POST', // Use POST for Odoo JSON routes (more reliable than PATCH)
            url: `${normalizedServerURL}/api/fo/update_unified/${patchId}?table_name=${odooTableName}&last_synced_date=${newLastSyncedDate}`,
            headers: {
              cookie: `${sessionID}; frontend_lang=en_GB`,
              'Content-Type': 'application/json',
              'User-Agent': 'insomnia/11.0.2',
              'X-FO-TOKEN': token
            },
            data: {
              jsonrpc: '2.0',
              method: 'call',
              // Include table_name in params for JSON endpoint, plus the update fields
              params: {
                table_name: odooTableName,
                ...newRecordDataToSend
              },
              id: null
            }
          };
          
          // Validate payload before sending
          if (Object.keys(newRecordDataToSend).length === 0) {
            console.warn(`⚠️ Skipping PATCH for ${tableName} (id: ${patchId}) - no fields to update`);
            continue; // Skip this operation
          }
          
          console.log('PATCH debug -> table:', tableName, 'odooTable:', odooTableName, 'id:', patchId, 'payload:', newRecordDataToSend);
          const response = await axios.request(patchOptions);
          console.log('PATCH response:', response.data);
          console.log('PATCH response:');
          console.log('#####################################################')
          // console.log('PATCHED RECORD', newRecordDataToSend)
          console.log('#####################################################')
          
          // Check if the server returned an error
          const patchResult = response.data;
          if (patchResult?.result && patchResult.result.success === false) {
            const errorMessage = patchResult.result.message || 'Unknown error updating record';
            // For record operations, treat server errors as handled (complete transaction, no retry)
            const warningMessage = `Server rejected PATCH for ${odooTableName || tableName} (id: ${patchId}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
            console.warn(`⚠️ ${warningMessage}`);
            await logToSystem('warning', warningMessage, op, { errorMessage, odooTableName: odooTableName || tableName, serverResponse: patchResult.result });
            // Do NOT throw here – this lets the transaction complete and drops the op
          } else {
            await logToSystem('success', `Record updated successfully.`, op, patchResult.result);
          }
        } catch (error: any) {
          const errorMessage = error?.message || String(error) || 'Unknown error';
          
          // Network errors should be retried
          if (isNetworkError(error)) {
            console.error(`❌ Network error during PATCH for ${odooTableName || tableName} (id: ${patchId}): ${errorMessage}. Will retry.`);
            throw error; // Re-throw to trigger PowerSync retry
          }
          
          // For other errors, treat as handled (complete transaction, no retry)
          const warningMessage = `PATCH request failed for ${odooTableName || tableName} (id: ${patchId}): ${errorMessage}. Treating as handled - transaction will complete (no retry)`;
          console.warn(`⚠️ ${warningMessage}`);
          await logToSystem('warning', warningMessage, op, { error: errorMessage, odooTableName: odooTableName || tableName });
          // Do NOT throw here – this lets the transaction complete and drops the op
        }
        break;
        case UpdateType.DELETE:
          //TODO: Instruct your backend API to DELETE a record
          break;
      }
      } catch (opError: any) {
        const errorMsg = opError?.message || opError?.toString() || 'Unknown error';
        
        // Network errors should be retried - re-throw to abort transaction
        if (isNetworkError(opError)) {
          console.error(`❌ Network error during operation for table ${op.table}, id ${op.id}: ${errorMsg}. Will retry transaction.`);
          throw opError; // Re-throw to abort transaction and trigger PowerSync retry
        }
        
        // Operation failed - mark it and continue with other operations
        allOpsSucceeded = false;
        failedOps.push({ op, error: errorMsg });
        
        // For other errors, treat as handled (will complete transaction, no retry)
        // This avoids maintaining hardcoded error message lists
        const warningMessage = `Operation failed for table ${op.table}, id ${op.id}: ${errorMsg}. Treating as handled - transaction will complete (no retry)`;
        console.warn(`⚠️ ${warningMessage}`);
        await logToSystem('warning', warningMessage, op, { error: errorMsg });
        // Continue processing other operations
      }
    }

    // Only complete the transaction if all operations succeeded
    if (allOpsSucceeded) {
      console.log('✅ All operations succeeded, completing transaction');
      await transaction.complete();
    } else {
      // For record operations, complete transaction even with errors (no retry)
      // This avoids maintaining hardcoded error message lists and handles new errors during season
      const warningMessage = `Transaction completed with ${failedOps.length} error(s) (will not retry)`;
      console.warn(`⚠️ ${warningMessage}`);
      
      // Log each failed operation as a warning
      for (const { op, error } of failedOps) {
        const opWarningMessage = `Transaction error - Table: ${op.table}, ID: ${op.id}, Error: ${error}`;
        console.warn(`  - ${opWarningMessage}`);
        await logToSystem('warning', opWarningMessage, op, { error, transactionErrors: failedOps.length });
      }
      
      // Also log a summary warning
      await logToSystem('warning', warningMessage, undefined, { failedOpsCount: failedOps.length, failedOps });
      
      await transaction.complete(); // Complete to prevent retry
    }

    if ((database as any).sync) {
      await (database as any).sync();
    }

    const currentStatus = (database as any).currentStatus;
           if (currentStatus?.lastSyncedAt) {
             console.log(`Last synced at after transaction: ${currentStatus.lastSyncedAt}`);
           }


  }
}