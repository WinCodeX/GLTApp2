import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

export default function TrackStatusScreen() {
  const { status } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 20 }}>
        {status?.toString().replace('-', ' ')} Packages
      </Text>
    </View>
  );
}