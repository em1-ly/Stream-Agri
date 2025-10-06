import { Stack } from 'expo-router';

export default function InputsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Inputs',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Issue Inputs',
          headerShown: false, // Hide the header for modal
          presentation: 'modal', // Make it a modal
          animation: 'slide_from_bottom', // Animation style
        }} 
      />
      <Stack.Screen 
        name="signature" 
        options={{ 
          title: 'Signature',
          headerShown: false, 
        }} 
      />
      
    </Stack>
  );
}