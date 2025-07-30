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
      {/* Left section: Menu + Title */}
      <View style={styles.leftContainer}>
        <TouchableOpacity onPress={handleOpenDrawer} style={styles.menuIcon}>
          <Feather name="menu" size={26} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>GLT Logistics</Text>
      </View>

      {/* Right section: Search */}
      <TouchableOpacity onPress={() => console.log('Search tapped')}>
        <Feather name="search" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.header,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 10,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System', // iOS default; update below if using a custom font
  },
});