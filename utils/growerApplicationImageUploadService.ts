import { powersync } from '@/powersync/system';
import axios from 'axios';

/**
 * Grower Application Image Upload Retry Service
 * Runs every 30 seconds to upload images that failed during initial grower application submission
 */

const IMAGE_UPLOAD_SERVER = 'https://gmsapp.eport.systems/api/upload/';
const RETRY_INTERVAL = 30 * 1000; // 30 seconds - much more reliable in production
const MIN_TIME_BETWEEN_CHECKS = 3 * 60 * 1000; // 3 minutes minimum between actual upload attempts

interface GrowerApplicationImageUploadRecord {
  id: string;
  grower_image: string | null;
  grower_national_id_image: string | null;
  grower_image_url: string | null;
  grower_national_id_image_url: string | null;
}

class GrowerApplicationImageUploadService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastUploadAttempt = 0;

  /**
   * Upload grower image to server
   */
  private async sendGrowerImageToServer(growerImageEncoded: string): Promise<string> {
    console.log('🔄 Retrying grower application image upload to server');

    try {
      const options = {
        method: 'POST',
        url: IMAGE_UPLOAD_SERVER,
        headers: {'Content-Type': 'application/json'},
        // timeout: 30000, // 30 second timeout
        data: {
          image: growerImageEncoded,
        }
      };
      
      const response = await axios.request(options);
      console.log('✅ Grower application image upload response:', response.data);
      
      if (response.data.error) {
        console.error('❌ Server error uploading grower application image:', response.data.error);
        throw new Error(response.data.error);
      }
      
      if (!response.data.url) {
        throw new Error('Server did not return image URL');
      }
      
      return response.data.url;
    } catch (error) {
      console.error('❌ Error uploading grower application image:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Grower application image upload timed out. Please check your internet connection and try again.');
        } else if (error.response) {
          throw new Error(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
        } else if (error.request) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
      }
      throw new Error('Failed to upload grower application image. Please try again.');
    }
  }

  /**
   * Upload grower national ID image to server
   */
  private async sendGrowerNationalIdImageToServer(growerNationalIdImageEncoded: string): Promise<string> {
    console.log('🔄 Retrying grower application national ID image upload to server');

    try {
      const options = {
        method: 'POST',
        url: IMAGE_UPLOAD_SERVER,
        headers: {'Content-Type': 'application/json'},
        // timeout: 30000, // 30 second timeout
        data: {
          image: growerNationalIdImageEncoded,
        }
      };

      const response = await axios.request(options);
      console.log('✅ Grower application national ID image upload response:', response.data);

      if (response.data.error) {
        console.error('❌ Server error uploading grower application national ID image:', response.data.error);
        throw new Error(response.data.error);
      }

      if (!response.data.url) {
        throw new Error('Server did not return image URL');
      }

      return response.data.url;
    } catch (error) {
      console.error('❌ Error uploading grower application national ID image:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Grower application national ID image upload timed out. Please check your internet connection and try again.');
        } else if (error.response) {
          throw new Error(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
        } else if (error.request) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
      }
      throw new Error('Failed to upload grower application national ID image. Please try again.');
    }
  }

  /**
   * Find grower application records that need image uploads
   */
  private async findRecordsNeedingUpload(): Promise<GrowerApplicationImageUploadRecord[]> {
    try {
      // First, find records from odoo_gms_grower_application with missing image URLs
      const growerApplicationQuery = `
        SELECT id, mobile_app_id, grower_image_url, grower_national_id_image_url
        FROM odoo_gms_grower_application
        WHERE state IN ('applied')
        AND (grower_image_url IS NULL OR grower_national_id_image_url IS NULL)
        AND mobile_app_id IS NOT NULL
      `;

      interface GrowerApplicationRecord {
        id: string;
        mobile_app_id: string;
        grower_image_url: string | null;
        grower_national_id_image_url: string | null;
      }

      interface MediaRecord {
        mobile_grower_image: string | null;
        mobile_grower_national_id_image: string | null;
      }

      const growerApplicationRecords = await powersync.getAll(growerApplicationQuery) as GrowerApplicationRecord[];
      console.log(`📋 Found ${growerApplicationRecords.length} grower application records with missing image URLs`);

      if (growerApplicationRecords.length === 0) {
        return [];
      }

      // For each grower application record, get the corresponding mobile images from media_files table
      const imageUploadRecords: GrowerApplicationImageUploadRecord[] = [];
      
      console.log('🔄 Starting to process grower application records...');
      for (let i = 0; i < growerApplicationRecords.length; i++) {
        const record = growerApplicationRecords[i];
        console.log(`🔍 Processing grower application record ${i + 1}/${growerApplicationRecords.length}: ${record.id}`);
        try {
          const mediaQuery = `
            SELECT mobile_grower_image, mobile_grower_national_id_image
            FROM media_files
            WHERE id = ? AND model = 'odoo_gms_grower_application'
          `;
          
          console.log(`📊 Querying media_files for grower application record: ${record.id} (mobile_app_id: ${record.mobile_app_id})`);
          const mediaRecords = await powersync.getAll(mediaQuery, [record.mobile_app_id]) as MediaRecord[];
          console.log(`🔍 Found ${mediaRecords.length} media records for grower application ${record.id}`);
          
          if (mediaRecords.length > 0) {
            const mediaRecord = mediaRecords[0];
            
            // Only include if there are mobile images to upload for missing URLs
            const needsGrowerImageUpload = !record.grower_image_url && mediaRecord.mobile_grower_image;
            const needsNationalIdUpload = !record.grower_national_id_image_url && mediaRecord.mobile_grower_national_id_image;
            
            console.log(`🔍 Grower application record ${record.id} analysis:`, {
              grower_image_url: record.grower_image_url,
              grower_national_id_image_url: record.grower_national_id_image_url,
              has_mobile_grower_image: !!mediaRecord.mobile_grower_image,
              has_mobile_national_id_image: !!mediaRecord.mobile_grower_national_id_image,
              needsGrowerImageUpload,
              needsNationalIdUpload
            });
            
            if (needsGrowerImageUpload || needsNationalIdUpload) {
              console.log(`✅ Adding grower application record ${record.id} to upload queue`);
              imageUploadRecords.push({
                id: record.id,
                grower_image_url: record.grower_image_url,
                grower_national_id_image_url: record.grower_national_id_image_url,
                grower_image: mediaRecord.mobile_grower_image,
                grower_national_id_image: mediaRecord.mobile_grower_national_id_image
              });
            } else {
              console.log(`⏭️ Skipping grower application record ${record.id} - no upload needed`);
            }
          } else {
            console.log(`⚠️ No media records found for grower application ${record.id}`);
          }
        } catch (mediaError) {
          console.error(`❌ Error fetching media files for grower application record ${record.id}:`, mediaError);
          // Continue with other records
        }
        console.log(`✅ Completed processing grower application record: ${record.id}`);
      }
      
      console.log('🏁 Finished processing all grower application records');

      console.log(`📋 Found ${imageUploadRecords.length} grower application records needing image upload`);
      // Log record IDs only to avoid potential issues with large image data
      console.log('grower application record IDs:', imageUploadRecords.map(r => r.id));

      console.log('🔄 About to return grower application imageUploadRecords...');
      return imageUploadRecords;
    } catch (error) {
      console.error('❌ Error finding grower application records needing upload:', error);
      return [];
    }
  }

  /**
   * Process a single grower application record for image uploads
   */
  private async processRecord(record: GrowerApplicationImageUploadRecord): Promise<void> {
    console.log(`🔄 Processing grower application record ${record.id} for image uploads`);
    
    let growerImageUrl = record.grower_image_url;
    let growerNationalIdImageUrl = record.grower_national_id_image_url;
    let hasUpdates = false;

    try {
      // Upload grower image if URL is missing
      if (!growerImageUrl && record.grower_image) {
        console.log(`📤 Uploading grower image for grower application record ${record.id}`);
        growerImageUrl = await this.sendGrowerImageToServer(record.grower_image);
        hasUpdates = true;
        console.log(`✅ Grower image uploaded successfully for grower application record ${record.id}`);
      }

      // Upload national ID image if URL is missing
      if (!growerNationalIdImageUrl && record.grower_national_id_image) {
        console.log(`📤 Uploading national ID image for grower application record ${record.id}`);
        growerNationalIdImageUrl = await this.sendGrowerNationalIdImageToServer(record.grower_national_id_image);
        hasUpdates = true;
        console.log(`✅ National ID image uploaded successfully for grower application record ${record.id}`);
      }

      // Update database if we have new URLs
      if (hasUpdates) {
        await powersync.execute(`
          UPDATE odoo_gms_grower_application 
          SET grower_image_url = ?, grower_national_id_image_url = ?
          WHERE id = ?
        `, [growerImageUrl, growerNationalIdImageUrl, record.id]);
        
        console.log(`✅ Database updated successfully for grower application record ${record.id}`);
      }

    } catch (error) {
      console.error(`❌ Failed to process grower application record ${record.id}:`, error);
      // Continue processing other records even if one fails
    }
  }

  /**
   * Main processing function - runs the retry logic
   */
  private async processImageUploads(): Promise<void> {
    if (this.isRunning) {
      return; // Skip if already running
    }

    // Check if enough time has passed since last upload attempt
    const now = Date.now();
    if (now - this.lastUploadAttempt < MIN_TIME_BETWEEN_CHECKS) {
      return; // Not enough time has passed, skip this cycle
    }

    this.isRunning = true;
    this.lastUploadAttempt = now;
    console.log('🚀 Starting grower application image upload retry service');

    try {
      console.log('🔍 Calling findRecordsNeedingUpload...');
      const records = await this.findRecordsNeedingUpload();
      console.log('✅ findRecordsNeedingUpload completed, returned records:', records.length);
      
      if (records.length === 0) {
        console.log('✅ No grower application records need image uploads');
        return;
      }

      console.log(`📊 Processing ${records.length} grower application records for image uploads`);
      
      // Process records sequentially to avoid overwhelming the server
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        console.log(`🚀 Starting to process grower application record ${i + 1}/${records.length}: ${record.id}`);
        await this.processRecord(record);
        console.log(`✅ Completed processing grower application record ${i + 1}/${records.length}: ${record.id}`);
        // Small delay between records to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Grower application image upload retry service completed successfully');
      
    } catch (error) {
      console.error('❌ Error in grower application image upload retry service:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the grower application image upload retry service
   */
  public start(): void {
    if (this.intervalId) {
      console.log('⚠️ Grower application image upload service already started');
      return;
    }

    console.log('🔄 Starting grower application image upload retry service (checks every 30 seconds)');
    
    // Run immediately on start
    this.processImageUploads();
    
    // Check every 30 seconds (much more reliable in production)
    this.intervalId = setInterval(() => {
      this.processImageUploads();
    }, RETRY_INTERVAL);
  }

  /**
   * Stop the grower application image upload retry service
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Grower application image upload retry service stopped');
    }
  }

  /**
   * Manually trigger a single run (useful for testing)
   */
  public async runOnce(): Promise<void> {
    console.log('🔄 Manually triggering grower application image upload retry service');
    await this.processImageUploads();
  }

  /**
   * Force run upload service immediately (bypasses time check)
   */
  public async forceRun(): Promise<void> {
    if (this.isRunning) {
      console.log('⏸️ Grower application upload service already running');
      return;
    }

    this.isRunning = true;
    this.lastUploadAttempt = Date.now();
    console.log('🚀 Force running grower application image upload service');

    try {
      const records = await this.findRecordsNeedingUpload();
      
      if (records.length === 0) {
        console.log('✅ No grower application records need image uploads');
        return;
      }

      console.log(`📊 Processing ${records.length} grower application records for image uploads`);
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        await this.processRecord(record);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Force grower application upload completed successfully');
    } catch (error) {
      console.error('❌ Error in force grower application upload:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton instance
export const growerApplicationImageUploadService = new GrowerApplicationImageUploadService();

// Auto-start the service when imported
export const startGrowerApplicationImageUploadService = () => {
  growerApplicationImageUploadService.start();
};

// Export for manual control
export const stopGrowerApplicationImageUploadService = () => {
  growerApplicationImageUploadService.stop();
};

export const runGrowerApplicationImageUploadServiceOnce = () => {
  return growerApplicationImageUploadService.runOnce();
};

export const forceRunGrowerApplicationImageUploadService = () => {
  return growerApplicationImageUploadService.forceRun();
};

/**
 * Get count of grower application records that need image uploads (for UI display)
 */
export const getGrowerApplicationUploadPendingCount = async (): Promise<number> => {
  try {
    // Query to find grower application records with missing image URLs but that should have them
    const growerApplicationQuery = `
      SELECT id, mobile_app_id, grower_image_url, grower_national_id_image_url
      FROM odoo_gms_grower_application
      WHERE state IN ('applied')
      AND (grower_image_url IS NULL OR grower_national_id_image_url IS NULL)
      AND mobile_app_id IS NOT NULL
    `;

    interface GrowerApplicationRecord {
      id: string;
      mobile_app_id: string;
      grower_image_url: string | null;
      grower_national_id_image_url: string | null;
    }

    interface MediaRecord {
      mobile_grower_image: string | null;
      mobile_grower_national_id_image: string | null;
    }

    const growerApplicationRecords = await powersync.getAll(growerApplicationQuery) as GrowerApplicationRecord[];
    
    if (growerApplicationRecords.length === 0) {
      return 0;
    }

    let pendingCount = 0;

    // Check each record to see if it has mobile images that need uploading
    for (const record of growerApplicationRecords) {
      try {
        const mediaQuery = `
          SELECT mobile_grower_image, mobile_grower_national_id_image
          FROM media_files
          WHERE id = ? AND model = 'odoo_gms_grower_application'
        `;
        
        const mediaRecords = await powersync.getAll(mediaQuery, [record.mobile_app_id]) as MediaRecord[];
        
        if (mediaRecords.length > 0) {
          const mediaRecord = mediaRecords[0];
          
          // Check if there are mobile images to upload for missing URLs
          const needsGrowerImageUpload = !record.grower_image_url && mediaRecord.mobile_grower_image;
          const needsNationalIdUpload = !record.grower_national_id_image_url && mediaRecord.mobile_grower_national_id_image;
          
          if (needsGrowerImageUpload || needsNationalIdUpload) {
            pendingCount++;
          }
        }
      } catch (mediaError) {
        console.error(`Error checking media for grower application record ${record.id}:`, mediaError);
        // Continue with other records
      }
    }

    return pendingCount;
  } catch (error) {
    console.error('Error getting grower application upload pending count:', error);
    return 0;
  }
};
