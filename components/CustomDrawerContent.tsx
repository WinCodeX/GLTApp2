import React, { useState } from 'react';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Feather,
  Ionicons,
  MaterialIcons,
  FontAwesome5,
} from '@expo/vector-icons';
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

        {/* Top Section with Avatar and Dropdown */}
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
            color={colors.primary}
          />
        </TouchableOpacity>

        {/* Account Dropdown */}
        {showAccountDropdown && (
          <View style={styles.accountDropdown}>
            <DrawerItem
              label="Account"
              labelStyle={styles.label}
              icon={() => <Feather name="user" size={22} color={colors.primary} />}
              onPress={() => props.navigation.navigate('account')}
            />
            <DrawerItem
              label="Add Account"
              labelStyle={styles.label}
              icon={() => <Feather name="plus" size={22} color={colors.primary} />}
              onPress={() => {}}
            />
          </View>
        )}

        {/* Track a package dropdown */}
        <DrawerItem
          label="Track a package"
          labelStyle={styles.label}
          icon={() => (
            <Feather
              name={showTrackDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.primary}
            />
          )}
          onPress={() => setShowTrackDropdown((prev) => !prev)}
        />

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

        {/* Other Drawer Items */}
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
        <DrawerItem
          label="Settings"
          labelStyle={styles.label}
          icon={() => <Ionicons name="settings-outline" size={24} color={colors.primary} />}
          onPress={() => props.navigation.navigate('settings')}
        />

        {/* Bottom Alert */}
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
    backgroundColor: '#1b1d2a',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2f3a',
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
    color: 'gray',
    fontSize: 13,
  },
  accountDropdown: {
    backgroundColor: '#1e1f2f',
    paddingLeft: 10,
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
  footerIcon: {
    marginTop: 'auto',
    alignSelf: 'center',
    marginBottom: 20,
  },
});