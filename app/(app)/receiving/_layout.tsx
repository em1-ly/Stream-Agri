import { Stack } from 'expo-router';

export default function ReceivingLayout() {
  return (
    <Stack>
      <Stack.Screen name="new-transporter-dnote" options={{ title: 'New Transporter DNote' }} />
      <Stack.Screen name="view-all-td-notes" options={{ title: 'View All TD Notes' }} />
      <Stack.Screen name="view-all-grower-d-notes" options={{ title: 'View all Grower D Notes' }} />
      <Stack.Screen name="add-bale-to-gd-note" options={{ title: 'Add Bale to GD Note' }} />
      <Stack.Screen name="sequencing-scanner" options={{ title: 'Sequencing Scanner' }} />
      <Stack.Screen name="transporter-details" options={{ title: 'Transporter Details' }} />
      <Stack.Screen name="check-grower-sequences" options={{ title: 'Check Grower Sequences' }} />
      <Stack.Screen name="grower-bookings" options={{ title: 'Grower Bookings' }} />
      <Stack.Screen name="row-management" options={{ title: 'Row Management' }} />
      <Stack.Screen name="create-daily-rows" options={{ title: 'Create Daily Rows' }} />
      <Stack.Screen name="start-new-lay" options={{ title: 'Start New Lay' }} />
    </Stack>
  );
}