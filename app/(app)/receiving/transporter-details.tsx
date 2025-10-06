import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function TransporterDetailsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Transporter Details' }} />
      <Text style={styles.text}>Transporter Details</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
