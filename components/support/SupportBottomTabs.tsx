// components/support/SupportBottomTabs.tsx - Bottom Navigation
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

interface SupportBottomTabsProps {
  currentTab: 'chats' | 'updates' | 'calls' | 'account';
}

export const SupportBottomTabs: React.FC<SupportBottomTabsProps> = ({ currentTab }) => {
  const pathname = usePathname();

  const tabs = [
    {
      key: 'chats',
      label: 'Chats',
      icon: 'message-square',
      route: '/(support)',
      badgeCount: 5, // Dynamic count would come from context
    },
    {
      key: 'updates',
      label: 'Updates',
      icon: 'layers',
      route: '/(support)/updates',
      badgeCount: 0,
    },
    {
      key: 'calls',
      label: 'Calls',
      icon: 'phone',
      route: '/(support)/calls',
      badgeCount: 0,
    },
    {
      key: 'account',
      label: 'Account',
      icon: 'user',
      route: '/(support)/account',
      badgeCount: 0,
    },
  ];

  const handleTabPress = (route: string) => {
    if (pathname !== route) {
      router.push(route);
    }
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.tabContent, isActive && styles.tabContentActive]}>
              <View style={styles.iconContainer}>
                <Feather
                  name={tab.icon as any}
                  size={22}
                  color={isActive ? '#FFFFFF' : '#8E8E93'}
                />
                {tab.badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 20,
    paddingTop: 16,
    paddingHorizontal: 12,
    marginHorizontal: -8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabContent: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 70,
  },
  tabContentActive: {
    backgroundColor: '#7B3F98',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1F2C34',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});