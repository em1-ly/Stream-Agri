import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function AddBaleToGDNoteScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add Bale to GD Note' }} />
      <Text style={styles.text}>Add Bale to GD Note</Text>
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
