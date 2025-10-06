// import React, { useCallback } from 'react'
// import { View, Alert, Text } from 'react-native'
// import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
// import { forceRunImageUploadService } from '@/utils/imageUploadService'
// import { SignatureCanvas } from '@/components/SignatureCanvas'
// import { powersync } from '@/powersync/system'

// const Signature = () => {

//     const { id, name, input_pack_name, uuid } = useLocalSearchParams()

//   // Trigger image upload check when settings screen is focused
//   useFocusEffect(
//     useCallback(() => {
//       forceRunImageUploadService().catch(error => 
//         console.log('Signature image upload check failed:', error)
//       );
//     }, [])
//   );

//   const handleSignatureSaved = async (signatureBase64: string) => {
//     try {
//       // Generate a unique ID for the signature
      
//       // Save to media_files table (following your existing pattern)
//     const cleanSignature = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, '');
//     const fixBase64Padding = (str: string) => {
//         // Remove any existing padding
//         const cleanStr = str.replace(/=/g, "");
//         // Calculate how much padding we need
//         const missingPadding = cleanStr.length % 4;
//         // Add the right amount of padding
//         return missingPadding ? cleanStr + '='.repeat(4 - missingPadding) : cleanStr;
//       };
//       const paddedSignature = fixBase64Padding(cleanSignature);

//       await powersync.execute(`
//         INSERT INTO media_files (id, mobile_signature_image, create_date, write_date, model)
//         VALUES (?, ?, ?, ?, ?)
//       `, [
//         uuid, 
//         paddedSignature, 
//         new Date().toISOString(), 
//         new Date().toISOString(), 
//         'odoo_gms_input_confirmations_lines'
//       ]);

//       console.log('Signature saved to database with ID:', uuid);
      
//       // Trigger the image upload service to upload to server
//       forceRunImageUploadService().catch(error => 
//         console.log('Signature upload service failed:', error)
//       );
      
//     } catch (error) {
//       console.error('Error saving signature to database:', error);
//       Alert.alert('Error', 'Failed to save signature to database');
//     }
//   };

//   return (
//     <>
//       <Stack.Screen options={{ 
//         title: "Sign Below",
//         headerShown: true, }} />
//       <View className="flex-1 p-4 bg-[#65435C]">

//         <Text className="text-xl font-bold text-white text-center">{name}</Text>
//         <Text className="text-sm font-bold text-white text-center">{input_pack_name}</Text>
      
//         <SignatureCanvas onSignatureSaved={handleSignatureSaved} />
//       </View>
//     </>
//   )
// }

// export default Signature




import React, { useCallback } from 'react'
import { View, Alert, Text } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as ImageManipulator from 'expo-image-manipulator'
import { forceRunImageUploadService } from '@/utils/imageUploadService'
import { SignatureCanvas } from '@/components/SignatureCanvas'
import { powersync } from '@/powersync/system'

const Signature = () => {
    const { id, name, input_pack_name, uuid } = useLocalSearchParams()

    // Trigger image upload check when settings screen is focused
    useFocusEffect(
        useCallback(() => {
            forceRunImageUploadService().catch(error =>
                console.log('Signature image upload check failed:', error)
            );
        }, [])
    );

    const compressSignature = async (base64Signature: string): Promise<string> => {
        try {
            // Convert base64 to URI format if not already
            const imageUri = base64Signature.startsWith('data:image')
                ? base64Signature
                : `data:image/png;base64,${base64Signature}`;

            // Compress the image using ImageManipulator
            // TODO: Upgrade package to latest version
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    // Resize to max width/height while maintaining aspect ratio
                    // Signatures don't need to be huge - 800px is plenty for most use cases
                    { resize: { width: 800 } }
                ],
                {
                    compress: 0.2, // Compress to 20% quality (good balance for signatures)
                    format: ImageManipulator.SaveFormat.JPEG, // JPEG is smaller than PNG for photos
                    base64: true // Return as base64
                }
            );

            return manipulatedImage.base64 || '';
        } catch (error) {
            console.error('Error compressing signature:', error);
            // Fall back to original if compression fails
            return base64Signature.replace(/^data:image\/[a-z]+;base64,/, '');
        }
    };

    const handleSignatureSaved = async (signatureBase64: string) => {
        try {
            // Compress the signature before saving
            const compressedSignature = await compressSignature(signatureBase64);

            // Clean and pad the compressed base64 string
            const cleanSignature = compressedSignature.replace(/^data:image\/[a-z]+;base64,/, '');
            
            const fixBase64Padding = (str: string) => {
                // Remove any existing padding
                const cleanStr = str.replace(/=/g, "");
                // Calculate how much padding we need
                const missingPadding = cleanStr.length % 4;
                // Add the right amount of padding
                return missingPadding ? cleanStr + '='.repeat(4 - missingPadding) : cleanStr;
            };
            
            const paddedSignature = fixBase64Padding(cleanSignature);

            // Log size comparison for debugging
            const originalSize = signatureBase64.length;
            const compressedSize = paddedSignature.length;
            const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(`Signature compressed: ${originalSize} → ${compressedSize} bytes (${reduction}% reduction)`);

            await powersync.execute(`
                INSERT INTO media_files (id, mobile_signature_image, create_date, write_date, model)
                VALUES (?, ?, ?, ?, ?)
            `, [
                id,
                paddedSignature,
                new Date().toISOString(),
                new Date().toISOString(),
                'odoo_gms_input_confirmations_lines'
            ]);

            console.log('Compressed signature saved to database with ID:', uuid);

            // Trigger the image upload service to upload to server
            forceRunImageUploadService().catch(error =>
                console.log('Signature upload service failed:', error)
            );

        } catch (error) {
            console.error('Error saving signature to database:', error);
            Alert.alert('Error', 'Failed to save signature to database');
        }
    };

    return (
        <>
            <Stack.Screen options={{
                title: "Sign Below",
                headerShown: true,
            }} />
            <View className="flex-1 p-4 bg-[#65435C]">
                <Text className="text-xl font-bold text-white text-center">{name} {id}</Text>
                <Text className="text-sm font-bold text-white text-center">{input_pack_name}</Text>

                <SignatureCanvas onSignatureSaved={handleSignatureSaved} />
            </View>
        </>
    )
}

export default Signature