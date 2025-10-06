// components/agent/AgentBottomTabs.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

interface AgentBottomTabsProps {
  currentTab: 'home' | 'chat' | 'updates' | 'calls' | 'account';
}

export const AgentBottomTabs: React.FC<AgentBottomTabsProps> = ({ currentTab }) => {
  const pathname = usePathname();

  const tabs = [
    {
      key: 'home',
      label: 'Home',
      icon: 'home',
      route: '/(agent)',
    },
    {
      key: 'chat',
      label: 'Chat',
      icon: 'message-square',
      route: '/(agent)/chat',
    },
    {
      key: 'updates',
      label: 'Updates',
      icon: 'layers',
      route: '/(agent)/updates',
    },
    {
      key: 'calls',
      label: 'Calls',
      icon: 'phone',
      route: '/(agent)/calls',
    },
    {
      key: 'account',
      label: 'Account',
      icon: 'user',
      route: '/(agent)/account',
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
              <Feather
                name={tab.icon as any}
                size={22}
                color={isActive ? '#FFFFFF' : '#8E8E93'}
              />
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
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 60,
  },
  tabContentActive: {
    backgroundColor: '#7B3F98',
  },
  tabLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});