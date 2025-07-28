import React from 'react';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { View, Text, Image, StyleSheet } from 'react-native';
import {
  Feather,
  Ionicons,
  MaterialIcons,
  FontAwesome5,
} from '@expo/vector-icons';
import colors from '../theme/colors';

export default function CustomDrawerContent(props: any) {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Avatar and Logo */}
        <View style={styles.profile}>
          <Image
            source={{ uri: 'https://i.imgur.com/0y8Ftya.png' }} // Replace with dynamic avatar
            style={styles.avatar}
          />
          <Text style={styles.logoText}>GLT :)</Text>
        </View>

        {/* Menu Items */}
        <DrawerItem
          label="Account"
          labelStyle={styles.label}
          icon={() => <Feather name="user" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('account')}
        />
        <DrawerItem
          label="Track a package"
          labelStyle={styles.label}
          icon={() => <Feather name="map-pin" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('track')}
        />
        <DrawerItem
          label="Talk to a rep"
          labelStyle={styles.label}
          icon={() => <Feather name="message-circle" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('support')}
        />
        <DrawerItem
          label="FAQs"
          labelStyle={styles.label}
          icon={() => <Feather name="help-circle" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('faqs')}
        />
        <DrawerItem
          label="History"
          labelStyle={styles.label}
          icon={() => <MaterialIcons name="history" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('history')}
        />
        <DrawerItem
          label="Settings"
          labelStyle={styles.label}
          icon={() => <Ionicons name="settings-outline" size={22} color={colors.primary} />}
          onPress={() => props.navigation.navigate('settings')}
        />

        {/* Alert Icon at Bottom */}
        <View style={styles.footerIcon}>
          <FontAwesome5 name="exclamation-circle" size={22} color={colors.primary} />
        </View>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
  },
  profile: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    marginLeft: -10,
  },
  footerIcon: {
    marginTop: 'auto',
    alignSelf: 'center',
    marginBottom: 20,
  },
});