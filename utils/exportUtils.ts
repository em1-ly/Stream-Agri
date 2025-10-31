import { powersync } from '@/powersync/system';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export interface ExportTable {
  name: string;
  displayName: string;
  query: string;
}

export const EXPORT_TABLES: ExportTable[] = [
  {
    name: 'hr_employee',
    displayName: 'Employees',
    query: 'SELECT * FROM hr_employee'
  },
  {
    name: 'odoo_gms_grower',
    displayName: 'Growers',
    query: 'SELECT * FROM odoo_gms_grower'
  },
  {
    name: 'odoo_gms_production_cycle_registration',
    displayName: 'Production Cycle Registrations',
    query: 'SELECT * FROM odoo_gms_production_cycle_registration'
  },
  {
    name: 'odoo_gms_grower_application',
    displayName: 'Grower Applications',
    query: 'SELECT * FROM odoo_gms_grower_application'
  },
  {
    name: 'odoo_gms_input_confirmations',
    displayName: 'Input Confirmations',
    query: 'SELECT * FROM odoo_gms_input_confirmations'
  },
  {
    name: 'odoo_gms_input_confirmations_lines',
    displayName: 'Input Confirmations Lines',
    query: 'SELECT * FROM odoo_gms_input_confirmations_lines'
  },
  {
    name: 'survey_survey',
    displayName: 'Surveys',
    query: 'SELECT * FROM survey_survey'
  },
  {
    name: 'survey_user_input',
    displayName: 'Survey User Inputs',
    query: 'SELECT * FROM survey_user_input'
  },
  {
    name: 'survey_user_input_line',
    displayName: 'Survey User Input Lines',
    query: 'SELECT * FROM survey_user_input_line'
  },
  {
    name: 'odoo_gms_production_cycle',
    displayName: 'Production Cycles',
    query: 'SELECT * FROM odoo_gms_production_cycle'
  },
  {
    name: 'odoo_gms_region',
    displayName: 'Regions',
    query: 'SELECT * FROM odoo_gms_region'
  },
  {
    name: 'odoo_gms_activity',
    displayName: 'Activities',
    query: 'SELECT * FROM odoo_gms_activity'
  },
  {name: 'media_files',
    displayName: 'Media Files',
    query: 'SELECT * FROM media_files'
  },
  {name: 'odoo_gms_collection_voucher',
    displayName: 'Collection Vouchers',
    query: 'SELECT * FROM odoo_gms_collection_voucher'
  },
  {name: 'odoo_gms_truck_reg',
    displayName: 'Truck Registrations',
    query: 'SELECT * FROM odoo_gms_truck_reg'
  }

];

export const exportTableToCSV = async (tableName: string, displayName: string, query: string): Promise<string> => {
  try {
    // Get data from PowerSync database
    const result = await powersync.getAll(query);
    
    if (!result || result.length === 0) {
      throw new Error(`No data found in ${displayName}`);
    }

    // Convert data to CSV format
    const firstRow = result[0] as Record<string, any>;
    const headers = Object.keys(firstRow);
    const csvHeaders = headers.join(',');
    
    const csvRows = result.map((row: any) => {
      return headers.map(header => {
        const value = row[header];
        // Handle values that contain commas, quotes, or newlines
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `${tableName}_${timestamp}.csv`;
    
    // Save file to documents directory
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8
    });

    return fileUri;
  } catch (error) {
    console.error(`Error exporting ${displayName}:`, error);
    throw error;
  }
};

export const shareCSVFile = async (fileUri: string, displayName: string): Promise<void> => {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${displayName} Data`,
      UTI: 'public.comma-separated-values-text'
    });
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};

export const exportAllTables = async (): Promise<string[]> => {
  const exportedFiles: string[] = [];
  
  for (const table of EXPORT_TABLES) {
    try {
      const fileUri = await exportTableToCSV(table.name, table.displayName, table.query);
      exportedFiles.push(fileUri);
    } catch (error) {
      console.error(`Failed to export ${table.displayName}:`, error);
    }
  }
  
  return exportedFiles;
}; 