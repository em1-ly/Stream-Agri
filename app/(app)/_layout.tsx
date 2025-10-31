import { useSession } from '@/authContext';
import { Redirect, Stack } from 'expo-router';
import 'react-native-reanimated';
import { StatusBar, Text, View } from 'react-native';
export default function RootLayout() {

  const { session, isLoading } = useSession();

  // You can keep the splash screen open, or render a loading screen like we do here.
  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  // Only require authentication within the (app) group's layout as users
  // need to be able to access the (auth) group and sign in again.
  if (!session) {
    // On web, static rendering will stop here as the user is not authenticated
    // in the headless Node process that the pages are rendered in.
    return <Redirect href="/(auth)/login"/>;
  }


  return (
    <View className="flex-1">
      <StatusBar backgroundColor="#65435C" barStyle="light-content" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}
