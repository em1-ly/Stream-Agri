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
    name: 'warehouse_delivery_bales',
    displayName: 'Warehouse Delivery Bales',
    query: 'SELECT * FROM warehouse_delivery_bales'
  },

  {
    name: 'warehouse_shipped_bales',
    displayName: 'Warehouse shipped Bales',
    query: 'SELECT * FROM warehouse_shipped_bale'
  },
  
  
  {
    name: 'receiving_bale',
    displayName: 'Receiving Bales',
    query: 'SELECT * FROM receiving_bale'
  },
  {
    name: 'receiving_curverid_bale_sequencing_model',
    displayName: 'Receiving Barcode Sequencing Model  ',
    query: 'SELECT * FROM receiving_curverid_bale_sequencing_model'
  },
  {
    name: 'warehouse_dispatch_bales',
    displayName: 'Warehouse Dispatch Bales ',
    query: 'SELECT * FROM warehouse_dispatch_bale'
  },

  {
    name: 'receiving_grower_delivery_note',
    displayName: 'Receiving Grower Delivery Note',
    query: 'SELECT * FROM receiving_grower_delivery_note'
  },

  {
    name: 'floor_maintenance_timb_grade',
    displayName: 'Floor Maintenance Timb Grade ',
    query: 'SELECT * FROM floor_maintenance_timb_grade'
  },
  
  {
    name: 'warehouse_driver',
    displayName: 'Warehouse Drivers',
    query: 'SELECT * FROM warehouse_driver'
  },

  {
    name: 'data_processing_salesmaster',
    displayName: 'Sales Masters',
    query: 'SELECT * FROM data_processing_salesmaster'
  },
  {
    name: 'warehouse_dispatch_note',
    displayName: 'Dispatch Notes',
    query: 'SELECT * FROM warehouse_dispatch_note'
  },






  

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
    
    // Save file to documents directory using legacy API
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent);

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