import { PowerSyncDatabase } from '@powersync/react-native';
import { Connector } from './Connector';
import { AppSchema } from './Schema';
import * as SecureStore from 'expo-secure-store';


export const powersync = new PowerSyncDatabase({
  
    // The schema you defined in the previous step
    schema: AppSchema,
    // For other options see,
    // https://powersync-ja.github.io/powersync-js/web-sdk/globals#powersyncopenfactoryoptions
    database: {
        // Filename for the SQLite database — it's important to only instantiate one instance per file.
        // For other database options see,
        // https://powersync-ja.github.io/powersync-js/web-sdk/globals#sqlopenoptions
        dbFilename: 'powersync.db'
    }
});

// Export connector instance so it can be accessed for manual upload triggers
export let connectorInstance: Connector | null = null;

export const setupPowerSync = async (clientId?: number) => {
  const odoo_employee_id = await SecureStore.getItemAsync('odoo_employee_id')

  console.log('Setting up PowerSync')
  console.log('odoo_employee_id', odoo_employee_id)

  // if (odoo_employee_id === null) {
  //   console.log('No employee ID found')
  //   return
  // }
  // Uses the backend connector that will be created in the next section
  connectorInstance = new Connector();
  
  // Connect with options including clientId if provided
  powersync.connect(connectorInstance, { 
    // clientId: clientId, // Will be undefined if not provided
    // You can also add client parameters here if needed
    params: {
      clientUserId: parseInt(odoo_employee_id || '0')
    }
  });
};