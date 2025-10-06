import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Settings',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="dbExport" 
        options={{ 
          title: 'DB Export',
          headerShown: false,
        }} 
      />
    </Stack>
  );
}