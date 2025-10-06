import { Stack } from 'expo-router';

export default function ReceivingLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Receiving',
          headerShown: false 
        }} 
      />
      {/* <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Grower Details',
          headerShown: true,
          // You can also make the title dynamic based on the grower
          // headerTitle: ({params}) => params?.name || 'Grower Details'
        }} 
      /> */}
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Grower Details',
          headerShown: false, // Hide the header for modal
          presentation: 'modal', // Make it a modal
          animation: 'slide_from_bottom', // Animation style
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{ 
          title: 'New Grower',
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
    </Stack>
  );
}