import { powersync } from '@/powersync/system';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React from 'react'; // Removed unused hooks
import QRCode from 'qrcode';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
// Removed unused react-native-qrcode-svg and react-native-view-shot imports

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

type GrowerDeliveryNoteData = {
  document_number?: string;
  grower_number?: string;
  grower_name?: string;
  number_of_bales_delivered?: number;
  create_date?: string;
  has_been_booked?: number;
  selling_point_name?: string;
  transporter_dnote_number?: string;
  vehicle_registration?: string;
  transporter_name?: string;
  transporter_cellphone?: string;
  driver_name?: string;
  grower_phone?: string;
  grower_national_id?: string;
  selling_date?: string;
  preferred_sale_date?: string;
  timb_failure_reason?: string;
};

/**
 * Generates and prints a Grower Delivery Note PDF locally (offline)
 * @param gdnId - The ID of the grower delivery note to print
 * @param printedBy - Optional name of the user printing the document
 */
export async function printGrowerDeliveryNoteLocally(gdnId: number | string, printedBy?: string): Promise<void> {
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
        // Fallback or leave empty
    }

    // Load grower delivery note data
    console.log('Printing GDN with ID:', gdnId);
    const results = await powersync.getAll<GrowerDeliveryNoteData>(
      `SELECT 
        gdn.document_number,
        gdn.grower_number,
        COALESCE(gdn.grower_name, td_line.grower_name) as grower_name,
        gdn.number_of_bales_delivered,
        gdn.create_date,
        gdn.has_been_booked,
        gdn.transporter_delivery_note_id,
        gdn.selling_date,
        gdn.preferred_sale_date,
        sp.name as selling_point_name,
        tdn.physical_dnote_number as transporter_dnote_number,
        tdn.vehicle_registration,
        tdn.transporter_name,
        tdn.transporter_cellphone,
        tdn.name as driver_name,
        rb.status_message as timb_failure_reason
      FROM receiving_grower_delivery_note gdn
      LEFT JOIN floor_maintenance_selling_point sp ON gdn.selling_point_id = sp.id
      LEFT JOIN receiving_transporter_delivery_note tdn ON gdn.transporter_delivery_note_id = tdn.id
      LEFT JOIN receiving_boka_transporter_delivery_note_line td_line 
        ON td_line.transporter_delivery_note_id = gdn.transporter_delivery_note_id 
        AND td_line.grower_number = gdn.grower_number
      LEFT JOIN receiving_grower_bookings rb ON rb.grower_delivery_note_id = gdn.id
      WHERE gdn.id = ?`,
      [String(gdnId)]
    );
    
    console.log('GDN Results:', JSON.stringify(results, null, 2));

    if (results.length === 0) {
      console.error(`Grower Delivery Note not found for ID: ${gdnId}`);
      throw new Error(`Grower Delivery Note not found (ID: ${gdnId})`);
    }
    const gdn = results[0];

    // Generate QR code
    let qrCodeBase64 = '';
    if (gdn.document_number) {
      try {
        const svg = await QRCode.toString(gdn.document_number, { type: 'svg' });
        qrCodeBase64 = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      } catch (err) {
        console.error('Failed to generate QR code', err);
        qrCodeBase64 = '';
      }
    }


    // Load grower details if available
    let growerPhone = '';
    let growerNationalId = '';
    let growerName = gdn.grower_name || ''; // Default to GDN name

    if (gdn.grower_number) {
      const cleanGrowerNumber = gdn.grower_number.trim();
      console.log(`Looking up grower details for number: '${cleanGrowerNumber}'`);
      
      const growers = await powersync.getAll<{ 
        phone?: string; 
        national_id?: string;
        name?: string;
        first_name?: string;
        surname?: string;
      }>(
        `SELECT 
          b040_phone_number as phone, 
          b030_national_id as national_id,
          name,
          b010_first_name as first_name,
          b020_surname as surname
        FROM odoo_gms_grower 
        WHERE grower_number = ? 
        LIMIT 1`,
        [cleanGrowerNumber]
      );

      if (growers.length > 0) {
        const g = growers[0];
        growerPhone = g.phone || '';
        growerNationalId = g.national_id || '';
        
        // If grower name is missing in GDN, try to construct it from grower record
        if (!growerName) {
          if (g.name) {
            growerName = g.name;
          } else if (g.first_name || g.surname) {
            growerName = `${g.first_name || ''} ${g.surname || ''}`.trim();
          }
        }
      } else {
        console.warn(`No grower found for number: ${cleanGrowerNumber}`);
      }
    }

    // Format date (with time) for create_date
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };
    // Format date only for Selling Date
    const formatDateOnly = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };
    const sellingDateStr = gdn.selling_date ? formatDateOnly(gdn.selling_date) : (gdn.preferred_sale_date ? formatDateOnly(gdn.preferred_sale_date) : '');
    const showTimbReason = !gdn.has_been_booked && (gdn.timb_failure_reason ?? '').trim() !== '';

    // Generate HTML for PDF (layout and styles match Odoo report grower_delivery_note_report.xml)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; }
            .page { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 15px; }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #8B7355;
              padding-bottom: 10px;
            }
            .header-left { display: flex; align-items: center; }
            .header-left h2 { margin: 0; color: #8B7355; font-size: 16px; font-weight: bold; }
            .header-mid { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
            .header-right { text-align: right; }
            .two-columns {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              gap: 15px;
              font-size: 14px;
            }
            .column { flex: 1; }
            .column-left { flex: 1; margin-right: 5px; }
            .field { margin-bottom: 10px; }
            .field label { font-weight: bold; display: block; margin-bottom: 3px; }
            .field-value {
              border: 1px solid #ccc;
              padding: 5px;
              background: white;
              min-height: 20px;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              align-items: end;
              margin-top: 25px;
            }
            .signature-line { border-bottom: 1px solid #000; width: 200px; margin-top: 5px; }
            .qr-placeholder {
              width: 100px; height: 100px;
              border: 1px solid #ddd;
              display: flex; align-items: center; justify-content: center;
              background: #f5f5f5; color: #666; font-size: 8px; text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <!-- Header (matches Odoo report) -->
            <div class="header">
              <div class="header-left">
                ${logoBase64 ? `<img src="${logoBase64}" style="max-height: 50px; margin-right: 15px;" alt="Company Logo"/>` : ''}
                <div>
                  <h2>DELIVERY NOTE</h2>
                  <div style="font-size: 9px; color: #666;">Curverid Tobacco Private Limited</div>
                </div>
              </div>
              <div class="header-mid">
                <div>${gdn.document_number || ''} | ${gdn.transporter_dnote_number || ''}</div>
                <div><strong>Selling Point:</strong> ${gdn.selling_point_name || ''}</div>
                <div><strong>Booked Status:</strong> ${gdn.has_been_booked ? 'True' : 'False'}</div>
                ${showTimbReason ? `<div><strong>TIMB Reason:</strong> ${(gdn.timb_failure_reason || '').trim()}</div>` : ''}
                ${sellingDateStr ? `<div><strong>Selling Date:</strong> ${sellingDateStr}</div>` : ''}
                <div><strong>Date:</strong> ${formatDate(gdn.create_date)}</div>
              </div>
              <div class="header-right">
                <div style="border: 1px solid #ccc; padding: 5px; background: white; text-align: center;">
                  <div style="margin-bottom: 5px;">
                    ${qrCodeBase64
                      ? `<img src="${qrCodeBase64}" style="width: 100px; height: 100px; border: 1px solid #ddd;" alt="QR Code"/>`
                      : `<div class="qr-placeholder">QR Code<br/>Not Available</div>`
                    }
                  </div>
                  <div style="font-size: 8px; font-weight: bold;"><span>${gdn.document_number || ''}</span></div>
                </div>
              </div>
            </div>

            <!-- Main Content - Two Columns (matches Odoo) -->
            <div class="two-columns">
              <div class="column column-left">
                <div class="field">
                  <label>Grower No</label>
                  <div class="field-value">${gdn.grower_number || ''}</div>
                </div>
                <div class="field">
                  <label>Initial G/N</label>
                  <div class="field-value">${gdn.grower_number || ''}</div>
                </div>
                <div class="field">
                  <label>Grower Name</label>
                  <div class="field-value">${growerName || ''}</div>
                </div>
                <div class="field">
                  <label>Grower Tel. No</label>
                  <div class="field-value">${growerPhone || ''}</div>
                </div>
                <div class="field">
                  <label>Grower ID</label>
                  <div class="field-value">${growerNationalId || ''}</div>
                </div>
                <div class="field">
                  <label>Declared Bales</label>
                  <div class="field-value" style="text-align: left;">${gdn.number_of_bales_delivered ?? 0}</div>
                </div>
              </div>
              <div class="column">
                <div class="field">
                  <label>Truck Reg No.</label>
                  <div class="field-value">${gdn.vehicle_registration || ''}</div>
                </div>
                <div class="field">
                  <label>Transporter Name</label>
                  <div class="field-value">${gdn.transporter_name || ''}</div>
                </div>
                <div class="field">
                  <label>Transporter CELL</label>
                  <div class="field-value">${gdn.transporter_cellphone || ''}</div>
                </div>
                <div class="field">
                  <label>Driver Name</label>
                  <div class="field-value">${gdn.driver_name || ''}</div>
                </div>
                <div class="field">
                  <label>Driver Tel. No.</label>
                  <div class="field-value">${gdn.transporter_cellphone || ''}</div>
                </div>
                <div class="field">
                  <label>Validated Bales:</label>
                  <div class="field-value">${gdn.number_of_bales_delivered ?? 0}</div>
                </div>
              </div>
            </div>

            <!-- Footer (matches Odoo) -->
            <div class="footer">
              <div>
                <div class="field">
                  <div class="signature-line"></div>
                  <strong>Signed Driver:</strong>
                </div>
              </div>
              <div style="text-align: center; margin-top: 5px; margin-bottom: 10px; font-size: 9px; color: #666;">
                Printed By: ${finalPrintedBy}
              </div>
              <div style="text-align: right;">
                <div class="field">
                  <div class="signature-line"></div>
                  <strong>Signed CTL:</strong>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Generate PDF and print
    await Print.printAsync({
      html,
      orientation: Print.Orientation.landscape,
    });

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate print document: ${error.message}`);
  }
}

