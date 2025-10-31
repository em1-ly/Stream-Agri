// import { AbstractPowerSyncDatabase, PowerSyncBackendConnector, UpdateType } from "@powersync/react-native";
// import axios from "axios";
// import * as SecureStore from 'expo-secure-store';
// export class Connector implements PowerSyncBackendConnector {

//   async getLocalData(database: AbstractPowerSyncDatabase, id: string) {
//     const record = await database.get('SELECT * FROM production_cycle_registration WHERE id = ?', [id]);
//     console.log('Local data:', record);
//     return record;
//   }

//   async getServerData(id: string) {
// 
// const options = {
// method: 'GET',
// url: `http://45.84.138.225:8069/api/fo/get-data/${id}?table_name=odoo_gms.production_cycle_registration`,
// params: {table_name: 'odoo_gms.production_cycle_registration'},
// headers: {
//   cookie: 'session_id=sZqyvCm3Paya3UgTLe1R5FY9EAyEA6-jmNbzuT3Egt20Yphpl8UJHxqzd0qjYUhzWnG7tMuLVluXaUYFfhPT; frontend_lang=en_GB',
//   'Content-Type': 'application/json',
//   'User-Agent': 'insomnia/11.0.2',
//   'X-FO-TOKEN': 'cfa0c7b5-9c87-4d8c-87c1-f8394fe1c94a'
// },
// data: {jsonrpc: '2.0', method: 'call', params: {}, id: null}
// };

//     const response = await axios.request(options);
//     if (response.data.success) {
//       console.log('Server data:', response.data.record);
//       return response.data.record;
//     } else {
//       console.log('No result found in response:', response.data);
//       return null;
//     }

//   }
//   /**
//   * Implement fetchCredentials to obtain a JWT from your authentication service.
//   * See https://docs.powersync.com/installation/authentication-setup
//   * If you're using Supabase or Firebase, you can re-use the JWT from those clients, see:
//   * https://docs.powersync.com/installation/authentication-setup/supabase-auth
//   * https://docs.powersync.com/installation/authentication-setup/firebase-auth
//   */
//   async fetchCredentials() {
//     const powerSyncURI = await SecureStore.getItemAsync('power_sync_uri')
    
//     // If powerSyncURI is null, return null or use a default endpoint
//     if (powerSyncURI === null) {
//       console.log('No powerSyncURI found')
//       return null; // Return null if URI not found
//     }
//     console.log('powerSyncURI', powerSyncURI)
    
//     return {
//       // The PowerSync instance URL or self-hosted endpoint
//       endpoint: powerSyncURI,
//       /**
//       * To get started quickly, use a development token, see:
//       * Authentication Setup https://docs.powersync.com/installation/authentication-setup/development-tokens) to get up and running quickly
//       */
//       token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6InBvd2Vyc3luYy1kZXYtMzIyM2Q0ZTMifQ.eyJzdWIiOiIxNDgiLCJpYXQiOjE3NDY3NzcxNTQsImlzcyI6Imh0dHBzOi8vcG93ZXJzeW5jLWFwaS5qb3VybmV5YXBwcy5jb20iLCJhdWQiOiJodHRwczovLzY3ZjZjMTZmOTg0YzZmNGNiMDc5NTljYS5wb3dlcnN5bmMuam91cm5leWFwcHMuY29tIiwiZXhwIjoxNzQ2ODIwMzU0fQ.jW_yOqJYalQEDV-KlUFaGPYokN7Ux5Sawiz7d0A5WUxstrgvkL1goJvxh4JJG8lB2oY19GjibMn_rak1rlMqY4xybYGDban-2cb94FsozmCcJhx9Qjd6jFnJpPRq8B0XTPcclaomnk63vKERdeMXLz7WW2YxZ_99XmlOHHcjvGqxNnK7Zx_kUnLMdJvCgyju98Virv-zK73pnQG4fh_RvECG7mkUmbPmKTg4ODFOlG5DFfcKeiAelXjgzQJL3KHlkdxmnYQBlailW2OItOnw7CaA8zU1DFZ0cBhwZyHbMRflOk0HxpBuBRKpEotreG-RAcqV_ODq_Ox6n6SnV6L5XQ'
//     };
//   }

//   /**
//   * Implement uploadData to send local changes to your backend service.
//   * You can omit this method if you only want to sync data from the database to the client
//   * See example implementation here:https://docs.powersync.com/client-sdk-references/react-native-and-expo#3-integrate-with-your-backend
//   */
//   async uploadData(database: AbstractPowerSyncDatabase) {
//     console.log('Starting uploadData method...');

//     /**
//     * For batched crud transactions, use data.getCrudBatch(n);
//     * https://powersync-ja.github.io/powersync-js/react-native-sdk/classes/SqliteBucketStorage#getcrudbatch
//     */
//     const transaction = await database.getNextCrudTransaction();

//     if (!transaction) {
//       console.log('No pending transactions to process');
//       return;
//     }
//     console.log('Processing pending transactions..., transaction:', transaction);
//     console.log(`Processing transaction with ${transaction.crud.length} operations`);


//     for (const op of transaction.crud) {
//       // The data that needs to be changed in the remote db
//       console.log('Full Data', op)
//       const record = { ...op.opData, id: op.id };
//       console.log(`Processing operation: ${op.op} for record ID: ${op.id}`);
//       console.log('Record data:', record);

//       // Log UpdateType enum values for clarity
//       console.log('UpdateType.PUT value:', UpdateType.PUT);
//       console.log('UpdateType.PATCH value:', UpdateType.PATCH);
//       console.log('UpdateType.DELETE value:', UpdateType.DELETE);
//       console.log('Value of op.op:', op.op);
//       console.log('Type of op.op:', typeof op.op);

//       switch (op.op) {
//         case UpdateType.PUT:
//           // TODO: Instruct your backend API to CREATE a record
//           break;
//         case UpdateType.PATCH:
//           // TODO: Instruct your backend API to PATCH a record

//           const localData = await this.getLocalData(database, record.id);
//           console.log('Local data:', localData);

//           const serverData = await this.getServerData(record.id);
//           console.log('Server data:', serverData);

//           console.log('#####################################################')
//           console.log('PATCH', record)
//           console.log('#####################################################')
//           console.log('Executing PATCH operation...');
//         try {
//           // Destructure id from record and keep the rest of the properties
//           const { id, ...recordDataToSend } = record;
//           let tableName
//           tableName = (op as any).type; // Assign table name from op.type

//           // Configure the request based on your Insomnia example
//           const patchOptions = {
//             method: 'PATCH',
//             url: `http://45.84.138.225:8069/api/update/${id}?table_name=odoo_gms.production_cycle_registration`, // Use the destructured id here
//             headers: {
//               cookie: 'session_id=sZqyvCm3Paya3UgTLe1R5FY9EAyEA6-jmNbzuT3Egt20Yphpl8UJHxqzd0qjYUhzWnG7tMuLVluXaUYFfhPT; frontend_lang=en_GB',
//               'Content-Type': 'application/json',
//               'User-Agent': 'insomnia/11.0.2',
//               'X-FO-TOKEN': 'cfa0c7b5-9c87-4d8c-87c1-f8394fe1c94a'
//             },
//             data: {
//               jsonrpc: '2.0',
//               method: 'call',
//               // Pass the record data without the id
//               params: recordDataToSend, 
//               id: null
//             }
//           };
          
//           console.log('Sending PATCH request:', patchOptions);
//           const response = await axios.request(patchOptions);
//           console.log('PATCH response:', response.data);
//         } catch (error) {
//           console.error('PATCH request failed:', error);
//           // You might want to handle the error or retry the operation
//           // For now, we'll continue processing other operations
//         }
//         break;
//         case UpdateType.DELETE:
//           //TODO: Instruct your backend API to DELETE a record
//           break;
//       }
//     }

//     // Completes the transaction and moves onto the next one
//     console.log('Completing transaction...');
//     await transaction.complete();
//     console.log('Transaction completed successfully');
//   }
// }















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



    // ADD THIS DEBUG SECTION:
    // console.log('🔍 Debugging transaction.crud:');
    // console.log('transaction.crud type:', typeof transaction.crud);
    // console.log('transaction.crud is array:', Array.isArray(transaction.crud));
    // console.log('transaction.crud:', transaction.crud);
    // console.log('transaction.crud[0]:', transaction.crud[0]);


    // console.log('Raw crud check:', !!transaction.crud);
    // console.log('Crud length check:', transaction.crud?.length);
    // console.log('First element direct access:', transaction.crud?.[0]);

    // Test if we can iterate
    try {
      console.log('🧪 Testing iteration...');
      // transaction.crud.forEach((op, index) => {
      //   console.log(`Operation ${index}:`, op);
      // });
    } catch (error) {
      // console.error('❌ Iteration failed:', error);
    }


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
          console.log('TABLE NAME', op.table)
          
          // If op.table include odoo_gms_ then remove odoo_gms_ from the table name
          let tableName = op.table
          if (tableName.includes('odoo_gms_')) {
            tableName = tableName.replace('odoo_gms_', '')
          }

          let response;

          // Special handling for receiving_bale table
          if (op.table === 'receiving_bale') {
            console.log('🎯 Using custom add-bale endpoint for receiving_bale');
            const baleOptions = {
              method: 'POST',
              url: `${normalizedServerURL}/api/fo/add-bale/`,
              headers: {
                'Content-Type': 'application/json',
                'X-FO-TOKEN': token
              },
              data: {
                jsonrpc: '2.0',
                method: 'call',
                params: {
                  document_number: (recordData as any).document_number || (recordData as any).grower_delivery_note_id,
                  barcode: (recordData as any).scale_barcode,
                  lot_number: (recordData as any).lot_number,
                  group_number: (recordData as any).group_number
                },
                id: 1
              }
            };
            response = await axios.request(baleOptions);
            console.log('✅ Add bale response', response.data);
          } else {
            // Default handling for other tables
            const options = {
              method: 'POST',
              url: `${normalizedServerURL}/api/fo/create`,
              headers: {
                'Content-Type': 'application/json',
                'X-FO-TOKEN': token
              },
              data: {
                jsonrpc: '2.0',
                method: 'call',
                params: {
                  type: tableName,
                  data: recordData
                }
              }
            };
            response = await axios.request(options);
            console.log('PUT response', response.data);
          }
          
          console.log('#####################################################')
          console.log('#####################################################')
          
          const serverRecord = await response.data
          console.log('serverRecord', serverRecord)
          // console.log('serverRecord', serverRecord.result.record.id)

          // if (op.table === 'survey_user_input') {
          //   console.log('survey_user_input - updating related lines')
          //   try {
          //     // Verify we have the server record ID
          //     const serverId = serverRecord?.result?.record?.id
          //     if (!serverId) {
          //       console.error('No server record ID found for survey_user_input')
          //       break
          //     }
              
          //     console.log(`Updating survey_user_input_line: ${id} -> ${serverId}`)
              
          //     // Check if there are any lines to update
          //     const existingLines = await database.getAll(`SELECT id FROM survey_user_input_line WHERE user_input_id = ?`, [id])
          //     console.log(`Found ${existingLines.length} lines to update`)
              
          //     if (existingLines.length > 0) {
          //       const updateUserInputLines = await database.execute(
          //         `UPDATE survey_user_input_line SET user_input_id = ? WHERE user_input_id = ?`, 
          //         [serverId, id]
          //       )
          //       console.log('updateUserInputLines result:', updateUserInputLines)
          //       console.log(`Successfully updated ${updateUserInputLines.rowsAffected || 0} survey_user_input_line records`)
          //     } else {
          //       console.log('No survey_user_input_line records found to update')
          //     }
          //   } catch (error) {
          //     console.error('Error updating survey_user_input_line records:', error)
          //   }
          // }


          // const updateLocal = await database.execute(
          //   `UPDATE ${op.table} SET id = ? WHERE id = ?`,
          //   [serverRecord.result.record.id, id]
          // );
          // console.log('UPDATED LOCAL RECORD', updateLocal)

          // const updatedLocalRecord = await database.get(`SELECT * FROM odoo_gms_grower WHERE id = ?`, [serverRecord.id])
          // console.log('UPDDATED LOCAL RECORD',updatedLocalRecord)

        }catch(error){
          console.error('PUT request failed:', error);
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

          //COMPARE RECORD TO SEND WITH CURRENT RECORD AND ONLY KEEP MATCHING VALUES
          let newRecordDataToSend: {[key: string]: any} = {};
          for (const [key, value] of Object.entries(recordDataToSend as Record<string, any>)) {
            if (value == (currentRecord as Record<string, any>)[key]) {
              newRecordDataToSend[key] = value;
            }
          }

          // Filter out columns that should not be synced to server
          const columnsToIgnore = ['mobile_grower_image', 'mobile_grower_national_id_image'];
            columnsToIgnore.forEach(column => {
              delete newRecordDataToSend[column];
              console.log('skipping column', column)
            });
          // console.log('newRecordDataToSend', newRecordDataToSend)

          // ADD LAST SYNCED DATE TO NEW RECORD DATA TO SEND
          // newRecordDataToSend['last_synced_date'] = lastSyncedDate

          // SET TABLE NAME TO ODOO DB NAME SCHEME
          const odooDbName = 'odoo_gms'
          let odooTableName = ''
          if (tableName.includes('odoo_gms_')) {
            odooTableName = tableName.replace('odoo_gms_', 'odoo_gms.')
          } else {
            odooTableName = odooDbName + '.' + tableName
          }

          // ADDING 1 MINUTES TO LAST SYNC TIME
          const newLastSyncedDate = new Date(lastSyncedDate.getTime() + 1 * 60 * 1000).toISOString();
          console.log('newLastSyncedDate', newLastSyncedDate)

          // Configure the request based on your Insomnia example
          const patchOptions = {
            method: 'PATCH',
            url: `${normalizedServerURL}/api/update/${id}?table_name=${odooTableName}&last_synced_date=${newLastSyncedDate}`, // Use the destructured id here
            headers: {
              cookie: `${sessionID}; frontend_lang=en_GB`,
              'Content-Type': 'application/json',
              'User-Agent': 'insomnia/11.0.2',
              'X-FO-TOKEN': token
            },
            data: {
              jsonrpc: '2.0',
              method: 'call',
              // Pass the record data without the id
              params: newRecordDataToSend,
              id: null
            }
          };
          
          // console.log('Sending PATCH request:', patchOptions);
          const response = await axios.request(patchOptions);
          console.log('PATCH response:', response.data);
          console.log('PATCH response:');
          console.log('#####################################################')
          // console.log('PATCHED RECORD', newRecordDataToSend)
          console.log('#####################################################')
        } catch (error) {
          console.error('PATCH request failed:', error);
          // You might want to handle the error or retry the operation
          // For now, we'll continue processing other operations
        }
        break;
        case UpdateType.DELETE:
          //TODO: Instruct your backend API to DELETE a record
          break;
      }
    }

    // Completes the transaction and moves onto the next one
    await transaction.complete();

    if ((database as any).sync) {
      await (database as any).sync();
    }

    const currentStatus = (database as any).currentStatus;
           if (currentStatus?.lastSyncedAt) {
             console.log(`Last synced at after transaction: ${currentStatus.lastSyncedAt}`);
           }


  }
}