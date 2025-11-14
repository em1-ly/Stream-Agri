import { AbstractPowerSyncDatabase, PowerSyncBackendConnector, UpdateType } from "@powersync/react-native";
import axios from "axios";
import * as SecureStore from 'expo-secure-store';
import { useSession } from "@/authContext";
import { powersync } from "./system";
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
    //Powersync status
  
    return {
      // The PowerSync instance URL or self-hosted endpoint
      endpoint: powerSyncURI,
      token: employeeJwt || '' // Provide empty string as fallback
      // token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6InBvd2Vyc3luYy1kZXYtMzIyM2Q0ZTMifQ.eyJzdWIiOiIxNDgiLCJpYXQiOjE3NTIwNDEyODYsImlzcyI6Imh0dHBzOi8vcG93ZXJzeW5jLWFwaS5qb3VybmV5YXBwcy5jb20iLCJhdWQiOiJodHRwczovLzY4MjJmNTgyMGMyODk5OGMyOGVmMTUwMS5wb3dlcnN5bmMuam91cm5leWFwcHMuY29tIiwiZXhwIjoxNzUyMDg0NDg2fQ.qgKn0D9DllBm5hXJG12nbDlYhL3-YAOtRC0dIiboZLkK1RbfF56orZ0fDToZ0F0H684jnYtWlf2DVfCsUkVAEfTGteKx6pV7vNJuugldll5njJ2NLs_kh4Flcp4ZnzAWPQfJMcLqvV1T-wQu3MaZk_Y4su5vuMLR7bBbDyQhKAC-YqQpZb6aSLKCVp2EOjmwZ05m_EIRE0fRRxNorDDiimOclaAkFMqpojX-ZwTzm9KAEV1QGHYrztTrOOcO1W5AoOzxw3ibvKk_0ZIsfs_8nZxpiCL-Tw-_wZMr34-y4yvCr7kTg1MoKMTHMvJKZERYz5BltLn8y9i7A_46K-GHCQ'
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
          try{

          console.log('#############PUT#################')
          console.log('PUTTING DATA', id)
          console.log('RECORD DATA', recordData)
        
          // Use original table name for special case checks
          const originalTableName = op.table;
          console.log('🔍 Processing PUT for table:', originalTableName);
          let tableName = originalTableName;
          let createType = tableName;
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
            // Special handling for bale sequencing - use 'bale_sequencing' type
            createType = 'bale_sequencing';
            // Map local fields to API fields
            // API expects: scale_barcode, row, lay, selling_point_id, floor_sale_id
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
              floor_sale_id: createData.floor_sale_id
            };
            console.log('📤 Bale sequencing - mapped to bale_sequencing type:', createData);
          } else {
            // For generic tables, transform table name prefixes for Odoo model names
            if (tableName.includes('receiving_curverid_')) {
              tableName = tableName.replace('receiving_curverid_', 'receiving_curverid.')
              createType = tableName;
            } else if (tableName.includes('odoo_gms_')) {
              tableName = tableName.replace('odoo_gms_', 'odoo_gms.')
              createType = tableName;
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
          
          console.log('📤 Sending to unified_create - type:', createType, 'data:', createData);
          const response = await axios.request(options)
          console.log('PUT response', response.data)
          console.log('#####################################################')
          // console.log('PUT RECORD', record)
          console.log('#####################################################')
          
          const serverRecord = await response.data
          console.log('serverRecord', serverRecord)
          
          // Check if the server returned an error
          if (serverRecord?.result && serverRecord.result.success === false) {
            const errorMessage = serverRecord.result.message || 'Unknown error creating record';
            
            // Check if this is a validation error that should have been caught by pre-validation
            // These errors indicate the record shouldn't be retried
            const validationErrors = [
              'already associated',
              'already exists',
              'duplicate',
              'invalid',
              'not found'
            ];
            
            const isValidationError = validationErrors.some(err => 
              errorMessage.toLowerCase().includes(err)
            );
            
            if (isValidationError) {
              // For validation errors, log as warning (not error) and don't retry
              console.warn(`⚠️ Server validation error for ${createType}: ${errorMessage}`);
              // Mark operation as failed but don't throw - this prevents retry
              throw new Error(`Validation error: ${errorMessage}`);
            } else {
              // For other errors, log as error and allow retry
              console.error(`❌ Server rejected ${createType} creation: ${errorMessage}`);
              throw new Error(`Server error: ${errorMessage}`);
            }
          }

        }catch(error: any){
          console.error('PUT request failed:', error);
          // Re-throw to prevent transaction completion
          throw error;
        }

          break;
        case UpdateType.PATCH:
          // TODO: Instruct your backend API to PATCH a record
         // Get the table name from the operation
         const tableName = op.table;
         let lastSyncedDate: Date = new Date();

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

          // Timeout for 5 seconds
          console.log('Waiting for 5 seconds...')
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log('5 seconds passed')


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
          
          // Special handling for bale updates - server expects all changed fields
          const isBale = tableName === 'receiving_bale';
          
          let newRecordDataToSend: {[key: string]: any} = {};
          
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
                                        'lot_number', 'group_number'];
            
            // First, check if is_released is in the current record but not in recordDataToSend
            // This handles the case where is_released was set locally but PowerSync didn't include it in the transaction
            const currentIsReleased = (currentRecord as Record<string, any>)?.['is_released'];
            const recordDataToSendTyped = recordDataToSend as Record<string, any>;
            if (currentIsReleased !== null && currentIsReleased !== undefined && !('is_released' in recordDataToSendTyped)) {
              // If is_released is set in the current record, include it in the update
              recordDataToSendTyped['is_released'] = currentIsReleased;
              console.log(`  ✅ Including is_released from current record: ${currentIsReleased}`);
            }
            
            for (const [key, value] of Object.entries(recordDataToSendTyped)) {
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
            for (const [key, value] of Object.entries(recordDataToSend as Record<string, any>)) {
              // Only include fields that have changed (or are new)
              if (value !== (currentRecord as Record<string, any>)[key]) {
                newRecordDataToSend[key] = value;
              }
            }
          }

          // Filter out columns that should not be synced to server
          const columnsToIgnore = ['mobile_grower_image', 'mobile_grower_national_id_image'];
          columnsToIgnore.forEach(column => {
            if (column in newRecordDataToSend) {
              delete newRecordDataToSend[column];
              console.log('skipping column', column)
            }
          });

          // Remove table_name from update payload (it's in the URL query string)
          delete newRecordDataToSend['table_name'];

          console.log('📋 Final payload after filtering:', newRecordDataToSend);
          console.log('📋 Payload keys count:', Object.keys(newRecordDataToSend).length);

          // ADD LAST SYNCED DATE TO NEW RECORD DATA TO SEND
          // newRecordDataToSend['last_synced_date'] = lastSyncedDate

          // SET TABLE NAME TO ODOO DB NAME SCHEME
          let odooTableName = ''
          
          // Special handling for different table name patterns
          if (tableName.includes('receiving_boka_')) {
            // receiving_boka_transporter_delivery_note_line -> receiving_boka.transporter_delivery_note_line
            odooTableName = tableName.replace('receiving_boka_', 'receiving_boka.')
          } else if (tableName === 'receiving_grower_delivery_note') {
            // receiving_grower_delivery_note -> receiving.grower_delivery_note
            odooTableName = 'receiving.grower_delivery_note'
          } else if (tableName.startsWith('receiving_')) {
            // receiving_bale, receiving_transporter_delivery_note, etc. -> receiving.bale, receiving.transporter_delivery_note
            odooTableName = tableName.replace('receiving_', 'receiving.')
          } else {
            // For other tables, use odoo_gms prefix
            odooTableName = 'odoo_gms.' + tableName
          }

          // ADDING 1 MINUTES TO LAST SYNC TIME
          const newLastSyncedDate = new Date(lastSyncedDate.getTime() + 1 * 60 * 1000).toISOString();
          console.log('newLastSyncedDate', newLastSyncedDate)

          // Configure the request - for JSON type endpoint, include table_name in params
          const patchOptions = {
            method: 'PATCH',
            url: `${normalizedServerURL}/api/update_unified/${id}?table_name=${odooTableName}&last_synced_date=${newLastSyncedDate}`,
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
            console.warn(`⚠️ Skipping PATCH for ${tableName} (id: ${id}) - no fields to update`);
            continue; // Skip this operation
          }
          
          console.log('PATCH debug -> table:', tableName, 'odooTable:', odooTableName, 'id:', id, 'payload:', newRecordDataToSend);
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
            console.error(`❌ Server rejected PATCH for ${odooTableName} (id: ${id}): ${errorMessage}`);
            throw new Error(`Server error: ${errorMessage}`);
          }
        } catch (error: any) {
          console.error('PATCH request failed:', error);
          // Re-throw to prevent transaction completion
          throw error;
        }
        break;
        case UpdateType.DELETE:
          //TODO: Instruct your backend API to DELETE a record
          break;
      }
      } catch (opError: any) {
        // Operation failed - mark it and continue with other operations
        allOpsSucceeded = false;
        const errorMsg = opError?.message || opError?.toString() || 'Unknown error';
        failedOps.push({ op, error: errorMsg });
        
        // Check if this is a validation error (shouldn't retry)
        const isValidationError = errorMsg.toLowerCase().includes('validation error') || 
                                  errorMsg.toLowerCase().includes('already associated') ||
                                  errorMsg.toLowerCase().includes('already exists');
        
        if (isValidationError) {
          // For validation errors, log as warning (not error) - these are expected
          console.warn(`⚠️ Validation failed for table ${op.table}, id ${op.id}: ${errorMsg}`);
        } else {
          // For other errors, log as error
          console.error(`❌ Operation failed for table ${op.table}, id ${op.id}:`, errorMsg);
        }
        // Continue processing other operations
      }
    }

    // Only complete the transaction if all operations succeeded
    if (allOpsSucceeded) {
      console.log('✅ All operations succeeded, completing transaction');
      await transaction.complete();
    } else {
      // Check if all failures are validation errors (shouldn't retry)
      const allValidationErrors = failedOps.every(({ error }) => 
        error.toLowerCase().includes('validation error') || 
        error.toLowerCase().includes('already associated') ||
        error.toLowerCase().includes('already exists')
      );
      
      if (allValidationErrors) {
        // All failures are validation errors - complete transaction to prevent retries
        console.warn(`⚠️ Transaction completed with ${failedOps.length} validation error(s) (will not retry)`);
        failedOps.forEach(({ op, error }) => {
          console.warn(`  - Table: ${op.table}, ID: ${op.id}, Error: ${error}`);
        });
        await transaction.complete(); // Complete to prevent retry
      } else {
        // Some failures are real errors - don't complete, allow retry
        console.error(`❌ Transaction incomplete: ${failedOps.length} operation(s) failed`);
        failedOps.forEach(({ op, error }) => {
          console.error(`  - Table: ${op.table}, ID: ${op.id}, Error: ${error}`);
        });
        // Don't complete the transaction - it will be retried later
        // PowerSync will retry failed transactions automatically
      }
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