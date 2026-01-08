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
    </Stack>
  );
}

