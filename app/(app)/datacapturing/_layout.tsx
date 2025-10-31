import { Stack } from 'expo-router';

export default function DataCapturingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="classification" options={{ title: 'Classification' }} />
      <Stack.Screen name="buyer-details" options={{ title: 'Buyer Details' }} />
      <Stack.Screen name="all-details" options={{ title: 'Release' }} />
      <Stack.Screen name="barcode-scanner" options={{ headerShown: false }} />
    </Stack>
  );
}
