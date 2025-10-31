import React from 'react';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scanType = params.scanType as string || 'document'; // 'document' or 'bale'
  const returnTo = (params.returnTo as string) || '';

  const handleBarcodeScanned = (barcode: string) => {
    // Navigate based on returnTo parameter
    if (returnTo === 'sequencing') {
      router.push({
        pathname: '/receiving/sequencing-scanner',
        params: { scannedBarcode: barcode }
      });
    } else if (returnTo === 'scale-bale') {
      router.push({
        pathname: '/receiving/scale-bale',
        params: { 
          scannedBarcode: barcode,
          row: params.row as string,
          lay: params.lay as string,
          selling_point_id: params.selling_point_id as string,
          floor_sale_id: params.floor_sale_id as string
        }
      });
    } else if (returnTo === '/receiving/add-new-bale' || returnTo === 'add-new-bale') {
      // Respect explicit return target for Add New Bale flow
      router.push({
        pathname: '/receiving/add-new-bale',
        params: {
          scannedBaleBarcode: barcode,
          documentNumber: (params.documentNumber as string) || '',
          hessianId: params.hessianId as string,
          locationId: params.locationId as string,
          hessianName: params.hessianName as string,
          locationName: params.locationName as string,
          preserveState: 'true'
        }
      });
    } else if (scanType === 'bale') {
      const docNum = params.documentNumber as string;
      router.push({
        pathname: '/receiving/add-bale-to-gd-note',
        params: {
          scannedBaleBarcode: barcode,
          documentNumber: docNum,
          preserveState: 'true'
        }
      });
    } else {
      router.push({
        pathname: '/receiving/add-bale-to-gd-note',
        params: { scannedBarcode: barcode }
      });
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BarcodeScanner
        scanType={scanType as 'document' | 'bale'}
        onBarcodeScanned={handleBarcodeScanned}
        onClose={handleClose}
        title={scanType === 'bale' ? 'Scan Bale Barcode' : 'Scan Document Number'}
        subtitle="Position the barcode within the frame"
      />
    </>
  );
}
