import React, { useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import Signature from "react-native-signature-canvas";

interface SignatureCanvasProps {
  onSignatureSaved?: (signatureBase64: string) => void;
}

export function SignatureCanvas({ onSignatureSaved }: SignatureCanvasProps) {
  const signatureRef = useRef<any>(null);

  const handleSignature = (signature: string) => {
    console.log('Signature captured, base64 length:', signature.length);
    
    if (onSignatureSaved) {
      onSignatureSaved(signature);
    }
    
    Alert.alert('Success', 'Signature saved successfully!');
  };

  const handleEmpty = () => {
    Alert.alert('Warning', 'Please draw a signature before saving');
  };

  const clearSignature = () => {
    signatureRef.current?.clearSignature();
  };

  const saveSignature = () => {
    signatureRef.current?.readSignature();
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-lg mb-5 text-center text-white">Please sign below</Text>

      <View 
        style={{
          flex: 1, 
          backgroundColor: 'white', 
          borderRadius: 10, 
          borderWidth: 1, 
          borderColor: '#ddd',
          marginBottom: 10
        }}
      >
        <Signature
          ref={signatureRef}
          onOK={handleSignature}
          onEmpty={handleEmpty}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle={`
            .m-signature-pad {
              box-shadow: none;
              border: none;
            }
            .m-signature-pad--body {
              border: none;
            }
            .m-signature-pad--footer {
              display: none;
            }
          `}
          autoClear={false}
          imageType="image/png"
          backgroundColor="white"
          penColor="#2563eb"
          minWidth={2}
          maxWidth={3}
        />
      </View>

      <View className="mt-5 flex-row justify-between">
        <TouchableOpacity
          className="p-2 m-2 border-2 border-gray-300 rounded-md items-center flex-1 mr-2"
          onPress={clearSignature}
        >
          <Text className="text-white text-xl font-semibold">Clear Signature</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="p-2 m-2 border-2 border-gray-300 rounded-md items-center flex-1 ml-2"
          onPress={saveSignature}
        >
          <Text className="text-white text-xl font-semibold">Save Signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
