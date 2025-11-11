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
      return `http://${url}`;
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
      return `http://${url}`;
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
        
          let tableName = op.table
          if (tableName.includes('odoo_gms_')) {
            tableName = tableName.replace('odoo_gms_', '')
          }


          const options = {
            method: 'POST',
            url: `${normalizedServerURL}/api/fo/create`,
            headers: {
              'Content-Type': 'application/json',
              // 'User-Agent': 'insomnia/11.2.0',
              'X-FO-TOKEN': token
            },
            data: {
                type: tableName,
                data: recordData
            }
          };
          
          const response = await axios.request(options)
          console.log('PUT response', response.data)
          console.log('#####################################################')
          // console.log('PUT RECORD', record)
          console.log('#####################################################')
          
          const serverRecord = await response.data
          console.log('serverRecord', serverRecord)
          

        }catch(error){
          console.error('PUT request failed:', error);
        }

          break;
        case UpdateType.PATCH:
          // TODO: Instruct your backend API to PATCH a record
         // Get the table name from the operation
         const tableName = op.table;
        try {
          // Destructure id from record and keep the rest of the properties
          const { id, ...recordDataToSend } = record;

          const patchOptions = {
            method: 'PATCH',
            url: `${normalizedServerURL}/api/update/${id}`,
            headers: {
              'Content-Type': 'application/json',
              'X-FO-TOKEN': token
            },
            data: recordDataToSend
          };
          
          console.log('Sending PATCH request:', patchOptions);
          const patchResponse = await axios.request(patchOptions);
          console.log('PATCH response:', patchResponse.data);
          
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