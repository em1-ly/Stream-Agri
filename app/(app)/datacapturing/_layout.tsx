import { Stack } from 'expo-router';

export default function DataCapturingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="classification" options={{ headerShown: false }} />
      <Stack.Screen name="buyer-details" options={{ headerShown: false }} />
      <Stack.Screen name="all-details" options={{ headerShown: false }} />
      <Stack.Screen name="barcode-scanner" options={{ headerShown: false }} />
      <Stack.Screen name="abitration" options={{ headerShown: false }} />
    </Stack>
  );
}
