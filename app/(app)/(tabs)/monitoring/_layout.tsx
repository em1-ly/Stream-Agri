import { Stack } from 'expo-router';

export default function MonitoringLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'M & E',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="surveyRegister" 
        options={{ 
          title: 'Survey Registers',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Survey Response',
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
       <Stack.Screen 
        name="newSurvey" 
        options={{ 
          title: 'New Survey',
          headerShown: false
        }} 
      />
    </Stack>
  );
}