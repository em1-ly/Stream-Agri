import { Stack } from 'expo-router';

export default function ReceivingLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Receiving',
          headerShown: true 
        }} 
      />
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
      {/* Screens from the other layout file */}
      <Stack.Screen name="barcode-scanner" options={{ title: 'Scan Barcode' }} />
      <Stack.Screen name="validate-td-line" options={{ title: 'Validate TD Line' }} />
      <Stack.Screen name="view-all-td-notes" options={{ title: 'View All TD Notes' }} />
      <Stack.Screen name="view-all-grower-d-notes" options={{ title: 'View all Grower D Notes' }} />
      <Stack.Screen name="add-bale-to-gd-note" options={{ title: 'Add Bale to GD Note' }} />
      <Stack.Screen name="sequencing-scanner" options={{ title: 'Sequencing Scanner' }} />
      <Stack.Screen name="scale-bale" options={{ title: 'Scale Bale' }} />
      <Stack.Screen name="transporter-details" options={{ title: 'Transporter Details' }} />
    
     
    </Stack>
  );
}