// components/GLTHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import colors from '../theme/colors';

export default function GLTHeader() {
  const navigation = useNavigation();

  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <View style={styles.container}>
      {/* Drawer toggle */}
      <TouchableOpacity onPress={handleOpenDrawer}>
        <Feather name="menu" size={24} color="white" />
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.title}>GLT Logistics</Text>

      {/* Search icon placeholder */}
      <TouchableOpacity onPress={() => console.log('Search tapped')}>
        <Feather name="search" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.header, // Make sure colors.header exists in your color theme
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
});