import { Stack } from 'expo-router';

export default function DataCapturingLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Data Capturing',
          headerShown: false,
          headerBackVisible: false
        }} 
      />
      <Stack.Screen 
        name="classification" 
        options={{ 
          title: 'Classification',
          headerShown: true,
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="buyer-details" 
        options={{ 
          title: 'Buyer Details',
          headerShown: true,
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="all-details" 
        options={{ 
          title: 'Release',
          headerShown: true,
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="abitration" 
        options={{ 
          title: 'Arbitration',
          headerShown: true,
          headerBackVisible: true
        }} 
      />
      <Stack.Screen name="barcode-scanner" options={{ headerShown: true }} />
    </Stack>
  );
}

