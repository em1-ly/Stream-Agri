import React, { useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import DrawPad, { DrawPadHandle } from "expo-drawpad";
import { captureRef } from "react-native-view-shot";

interface SignaturePadProps {
  onSignatureSaved?: (signatureBase64: string) => void;
}

export function SignaturePad({ onSignatureSaved }: SignaturePadProps) {
  const drawPadRef = useRef<DrawPadHandle>(null);
  const viewRef = useRef<View>(null);
  const pathLength = useSharedValue(0);
  const playing = useSharedValue(false);
  const signed = useSharedValue(false);

  const saveSignature = async () => {
    try {
      if (!viewRef.current) {
        Alert.alert('Error', 'Unable to capture signature');
        return;
      }

      drawPadRef.current?.play()

      // Capture the signature as base64 using Expo's captureRef
      const signatureUri = await captureRef(viewRef, {
        format: 'png',
        quality: 0.9,
        result: 'data-uri'
      });
      
      // Remove data:image/png;base64, prefix if present
      const cleanBase64 = signatureUri.replace(/^data:image\/[a-z]+;base64,/, '');
      
      if (onSignatureSaved) {
        onSignatureSaved(cleanBase64);
      }
      
      Alert.alert('Success', 'Signature saved successfully!');
      
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'Failed to save signature');
    }
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-lg mb-5 text-center">Please sign below</Text>

      <View 
        ref={viewRef}
        style={{flex: 1, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#ddd'}}
      >
        <DrawPad
          ref={drawPadRef}
          stroke="#2563eb"
          strokeWidth={2}
          pathLength={pathLength}
          playing={playing}
          signed={signed}
        />
      </View>

      <View className="mt-5 flex-row justify-between">
        <TouchableOpacity
          className="p-4 bg-gray-100 rounded-md items-center flex-1 mr-2"
          onPress={() => drawPadRef.current?.erase()}
        >
          <Text>Clear Signature</Text>
        </TouchableOpacity>
        
        {/* <TouchableOpacity
          className="p-4 bg-gray-100 rounded-md items-center flex-1 mx-1"
          onPress={() => drawPadRef.current?.play()}
        >
          <Text>Replay Signature</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          className="p-4 bg-blue-500 rounded-md items-center flex-1 ml-2"
          onPress={saveSignature}
        >
          <Text className="text-white font-semibold">Save Signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

