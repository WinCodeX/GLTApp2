// app/admin/panels/CreateLocation.tsx
import React from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

export default function CreateLocation() {
  return (
    <View>
      <Text style={styles.label}>Location Name</Text>
      <TextInput style={styles.input} placeholder="Enter location..." />
      <Button title="Create" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: 'white', marginBottom: 4 },
  input: {
    backgroundColor: '#1e1e2f',
    borderRadius: 8,
    marginBottom: 12,
    color: '#fff',
    paddingHorizontal: 10,
  },
});