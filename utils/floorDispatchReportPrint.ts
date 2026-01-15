import { powersync } from '@/powersync/system';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// Helper to convert image asset to base64
const imageToBase64 = async (asset: Asset): Promise<string> => {
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('Failed to download asset');
  }
  const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${asset.type};base64,${base64}`;
};

type DispatchNoteData = {
  id: string;
  reference?: string;
  name?: string;
  origin_name?: string;
  warehouse_destination_name?: string;
  product_name?: string;
  transport_name?: string;
  truck_reg_number?: string;
  driver_name?: string;
  driver_national_id?: string;
  driver_cellphone?: string;
  state?: string;
  create_date?: string;
  write_date?: string;
};

type DispatchedBaleData = {
  barcode?: string;
  scale_barcode?: string;
  mass?: number;
};

/**
 * Generates and prints a Floor Dispatch Report PDF locally (offline)
 * @param dispatchNoteId - The ID of the dispatch note to print
 * @param printedBy - Optional name of the user printing the document
 */
export async function printFloorDispatchReportLocally(
  dispatchNoteId: string | number,
  printedBy?: string
): Promise<void> {
  try {
    // Resolve Printed By name
    let finalPrintedBy = printedBy || 'Mobile App';
    if (!printedBy) {
      try {
        const rawSession = await SecureStore.getItemAsync('session');
        if (rawSession) {
          const session = JSON.parse(rawSession);
          if (session.name) {
            finalPrintedBy = session.name;
          }
        }
      } catch (e) {
        console.warn('Failed to load session for print footer', e);
      }
    }

    // Load logo asset and convert to base64
    let logoBase64 = '';
    try {
      const logoAsset = Asset.fromModule(require('@/assets/images/ctl_logo.png'));
      logoBase64 = await imageToBase64(logoAsset);
    } catch (e) {
      console.warn('Failed to load logo asset for PDF', e);
    }

    // Load dispatch note data
    console.log('Printing Floor Dispatch Report with ID:', dispatchNoteId);
    const dispatchNoteResults = await powersync.getAll<DispatchNoteData>(
      `SELECT 
        dn.id,
        dn.reference,
        dn.name,
        sp.name as origin_name,
        wh.name as warehouse_destination_name,
        p.name as product_name,
        t.name as transport_name,
        dn.truck_reg_number,
        dn.driver_name,
        dn.driver_national_id,
        dn.driver_cellphone,
        dn.state,
        dn.create_date,
        dn.write_date
      FROM floor_dispatch_note dn
      LEFT JOIN floor_maintenance_selling_point sp ON dn.origin_id = sp.id
      LEFT JOIN warehouse_warehouse wh ON dn.warehouse_destination_id = wh.id
      LEFT JOIN warehouse_product p ON dn.product_id = p.id
      LEFT JOIN warehouse_transport t ON dn.transport_id = t.id
      WHERE dn.id = ? OR dn.mobile_app_id = ?
      LIMIT 1`,
      [String(dispatchNoteId), String(dispatchNoteId)]
    );

    if (dispatchNoteResults.length === 0) {
      throw new Error(`Dispatch note not found (ID: ${dispatchNoteId})`);
    }
    const dispatchNote = dispatchNoteResults[0];

    // Load dispatched bales and calculate totals
    const bales = await powersync.getAll<DispatchedBaleData>(
      `SELECT 
        rb.barcode,
        rb.scale_barcode,
        rb.mass
      FROM floor_dispatch_bale db
      LEFT JOIN receiving_bale rb ON db.receiving_bale_id = rb.id
      LEFT JOIN floor_dispatch_note dn ON (db.dispatch_note_id = dn.id OR db.dispatch_note_id = dn.mobile_app_id)
      WHERE dn.id = ? OR dn.mobile_app_id = ?`,
      [String(dispatchNoteId), String(dispatchNoteId)]
    );

    const totalBales = bales.length;
    const totalMass = bales.reduce((sum, bale) => sum + (bale.mass || 0), 0);

    // Format date
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return 'N/A';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return dateStr;
      }
    };

    // Format state
    const formatState = (state?: string) => {
      if (!state) return 'N/A';
      if (state === 'draft') return 'Draft';
      if (state === 'posted') return 'Posted';
      return state;
    };

    // Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 10px;
              margin: 0;
              padding: 20px;
            }
            .page {
              font-family: Arial, sans-serif;
              font-size: 10px;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h2 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .info-table td {
              padding: 8px;
              border: none;
              font-size: 10px;
            }
            .info-table td:first-child {
              font-weight: bold;
              width: 40%;
            }
            .summary-section {
              margin-bottom: 20px;
            }
            .summary-section h4 {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #333;
            }
            .summary-table thead {
              background-color: #f0f0f0;
            }
            .summary-table th {
              padding: 10px;
              border: 1px solid #333;
              text-align: left;
              font-weight: bold;
              font-size: 11px;
            }
            .summary-table td {
              padding: 10px;
              border: 1px solid #333;
              font-size: 10px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
              font-size: 9px;
              color: #666;
              text-align: center;
            }
            .logo {
              max-width: 100px;
              max-height: 50px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            ${logoBase64 ? `<div style="text-align: center;"><img src="${logoBase64}" class="logo" alt="Logo" /></div>` : ''}
            
            <div class="header">
              <h2><strong>FLOOR DISPATCH REPORT</strong></h2>
            </div>

            <div class="info-section">
              <table class="info-table">
                <tr>
                  <td><strong>Reference:</strong></td>
                  <td>${dispatchNote.reference || dispatchNote.name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Source:</strong></td>
                  <td>${dispatchNote.origin_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Destination Warehouse:</strong></td>
                  <td>${dispatchNote.warehouse_destination_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Product:</strong></td>
                  <td>${dispatchNote.product_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Transport Name:</strong></td>
                  <td>${dispatchNote.transport_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Dispatch Date:</strong></td>
                  <td>${formatDate(dispatchNote.create_date || dispatchNote.write_date)}</td>
                </tr>
              </table>
            </div>

            <div class="info-section">
              <table class="info-table">
                <tr>
                  <td><strong>Truck Registration:</strong></td>
                  <td>${dispatchNote.truck_reg_number || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Driver Name:</strong></td>
                  <td>${dispatchNote.driver_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Driver ID:</strong></td>
                  <td>${dispatchNote.driver_national_id || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Driver Phone:</strong></td>
                  <td>${dispatchNote.driver_cellphone || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>State:</strong></td>
                  <td>${formatState(dispatchNote.state)}</td>
                </tr>
              </table>
            </div>

            <div class="summary-section">
              <h4><strong>Dispatch Summary</strong></h4>
              <table class="summary-table">
                <thead>
                  <tr>
                    <th>Total Bales Dispatched</th>
                    <th>Total Mass (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${totalBales}</td>
                    <td>${totalMass.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <p>Printed by: ${finalPrintedBy}</p>
              <p>Printed on: ${new Date().toLocaleString('en-GB')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Generate PDF and print
    await Print.printAsync({
      html,
      orientation: Print.Orientation.portrait,
    });

    console.log('✅ Floor Dispatch Report printed successfully');
  } catch (error: any) {
    console.error('Error generating Floor Dispatch Report PDF:', error);
    throw new Error(`Failed to generate print document: ${error.message}`);
  }
}

