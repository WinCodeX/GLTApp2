import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import colors from '../theme/colors';

export default function CustomDrawerContent(props: any) {
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const trackingStatuses = [
    { label: 'Pending', key: 'pending', icon: 'clock' },
    { label: 'Paid', key: 'paid', icon: 'check-circle' },
    { label: 'Submitted', key: 'submitted', icon: 'upload' },
    { label: 'In transit', key: 'in-transit', icon: 'truck' },
    { label: 'Delivered', key: 'delivered', icon: 'box' },
    { label: 'Collected', key: 'collected', icon: 'archive' },
    { label: 'Rejected', key: 'rejected', icon: 'x-circle' },
  ];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.container}>

        {/* Account Section */}
        <TouchableOpacity
          onPress={() => setShowAccountDropdown(!showAccountDropdown)}
          style={styles.accountHeader}
        >
          <Image
            source={{ uri: 'https://i.imgur.com/0y8Ftya.png' }}
            style={styles.avatar}
          />
          <View style={styles.accountInfo}>
            <Text style={styles.userName}>Xs</Text>
            <Text style={styles.userPhone}>+254 712 293 377</Text>
          </View>
          <Feather
            name={showAccountDropdown ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>

        {showAccountDropdown && (
          <View style={styles.accountDropdown}>
            <DrawerItem
              label="Account"
              labelStyle={styles.label}
              icon={() => <Feather name="user" size={22} color="#fff" />}
              onPress={() => props.navigation.navigate('account')}
            />
            <DrawerItem
              label="Add Account"
              labelStyle={styles.label}
              icon={() => <Feather name="plus" size={22} color="#fff" />}
              onPress={() => {}}
            />
          </View>
        )}

        {/* Track a Package */}
        <View style={styles.customItem}>
          <View style={styles.trackHeader}>
            <Feather name="map-pin" size={20} color={colors.primary} style={styles.trackIcon} />
            <Text style={styles.trackLabel}>Track a package</Text>
            <TouchableOpacity onPress={() => setShowTrackDropdown((prev) => !prev)}>
              <Feather
                name={showTrackDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {showTrackDropdown &&
          trackingStatuses.map((item) => (
            <DrawerItem
              key={item.key}
              label={item.label}
              labelStyle={styles.subLabel}
              icon={() => (
                <Feather name={item.icon as any} size={20} color={colors.primary} />
              )}
              style={styles.subItem}
              onPress={() =>
                props.navigation.navigate({
                  name: 'track',
                  params: { status: item.key },
                  merge: true,
                })
              }
            />
          ))}

        {/* General Navigation */}
        <DrawerItem
          label="Talk to a rep"
          labelStyle={styles.label}
          icon={() => <Feather name="message-circle" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('support')}
        />
        <DrawerItem
          label="FAQs"
          labelStyle={styles.label}
          icon={() => <Feather name="help-circle" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('faqs')}
        />
        <DrawerItem
          label="History"
          labelStyle={styles.label}
          icon={() => <MaterialIcons name="history" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('history')}
        />

        {/* Contacts ABOVE Settings */}
        <DrawerItem
          label="Contacts"
          labelStyle={styles.label}
          icon={() => <Feather name="user" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('contacts')}
        />

        {/* Settings */}
        <DrawerItem
          label="Settings"
          labelStyle={styles.label}
          icon={() => <Ionicons name="settings-outline" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('settings')}
        />

        {/* Invite Friends BELOW Settings */}
        <DrawerItem
          label="Invite Friends"
          labelStyle={styles.label}
          icon={() => <Feather name="user-plus" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('invite')}
        />

        {/* Footer Icon */}
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
    paddingTop: 10,
  },
  accountHeader: {
    backgroundColor: '#601DA6',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  userPhone: {
    color: 'white',
    fontSize: 13,
  },
  accountDropdown: {
    backgroundColor: '#4D2292',
    marginHorizontal: 12,
    marginTop: 6,
    paddingLeft: 10,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    marginLeft: -5,
  },
  subLabel: {
    color: colors.text,
    fontSize: 15,
    marginLeft: 10,
  },
  subItem: {
    paddingLeft: 30,
    paddingVertical: 0,
  },
  customItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackIcon: {
    marginRight: 10,
  },
  trackLabel: {
    flex: 1,
    fontSize: 17,
    color: colors.text,
  },
  footerIcon: {
    marginTop: 'auto',
    alignSelf: 'center',
    marginBottom: 20,
  },
});