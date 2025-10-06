import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function StartNewLayScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Start New Lay' }} />
      <Text style={styles.text}>Start New Lay</Text>
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
