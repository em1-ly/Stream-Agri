import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function CheckGrowerSequencesScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Check Grower Sequences' }} />
      <Text style={styles.text}>Check Grower Sequences</Text>
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
