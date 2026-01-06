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
        headerTitleStyle: {
          fontSize: 16,
          color: '#65435C',
          fontWeight: '600',
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
      <Stack.Screen name="new-transporter-dnote" options={{ title: 'New Transporter DNote' }} />
      <Stack.Screen name="view-all-td-notes" options={{ title: 'View All TD Notes' }} />
      <Stack.Screen name="view-all-grower-d-notes" options={{ title: 'View all Grower D Notes' }} />
      <Stack.Screen name="add-bale-to-gd-note" options={{ title: 'Add Bale to GD Note' }} />
      <Stack.Screen name="add-new-bale" options={{ title: 'Add New Bale' }} />
      <Stack.Screen name="barcode-scanner" options={{ title: 'Scan Barcode' }} />
      <Stack.Screen name="validate-td-line" options={{ title: 'Validate TD Line' }} />
      <Stack.Screen name="scale-bale" options={{ title: 'Scale Bale' }} />
      <Stack.Screen name="sequencing-scanner" options={{ title: 'Sequencing Scanner' }} />
      <Stack.Screen name="transporter-details" options={{ title: 'Transporter Details' }} />
      <Stack.Screen name="check-grower-sequences" options={{ title: 'Check Grower Sequences' }} />
      <Stack.Screen name="grower-bookings" options={{ title: 'Grower Bookings' }} />
      <Stack.Screen name="row-management" options={{ title: 'Row Management' }} />
      <Stack.Screen name="create-daily-rows" options={{ title: 'Create Daily Rows' }} />
      <Stack.Screen name="start-new-lay" options={{ title: 'Start New Lay' }} />
      <Stack.Screen name="edit-bale" options={{ title: 'Edit Bale' }} />
      <Stack.Screen name="bale-resequencing" options={{ title: 'Bale Resequencing' }} />
    </Stack>
  );
}