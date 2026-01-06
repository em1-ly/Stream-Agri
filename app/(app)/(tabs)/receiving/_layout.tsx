import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReceivingLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          height: insets.top + 50,
          backgroundColor: 'transparent',
        },
        headerBackground: () => (
          <View style={{ flex: 1 }}>
            {/* Dark purple area for status bar - precise inset */}
            <View style={{ height: insets.top, backgroundColor: '#65435C' }} />
            {/* White area for custom navbar content */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
          </View>
        ),
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Receiving',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{ 
          title: 'New Receiving',
          headerShown: false 
        }} 
      />
    </Stack>
  );
}