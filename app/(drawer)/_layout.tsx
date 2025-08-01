// app/(drawer)/_layout.tsx
import React from 'react';
import { Dimensions, ColorValue } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';

import CustomDrawerContent from '@/components/CustomDrawerContent';
import colors from '@/theme/colors';

// Define drawer icons for each screen
const drawerIcons: Record<string, { name: string; lib: any }> = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  Support: { name: 'message-circle', lib: Feather },
  FAQs: { name: 'help-circle', lib: Feather },
  History: { name: 'history', lib: MaterialIcons },
  Settings: { name: 'settings-outline', lib: Ionicons },
};

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }) => {
        const iconData = drawerIcons[route.name] || { name: 'circle', lib: Feather };
        const IconComponent = iconData.lib;

        return {
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.background,
            width: drawerWidth,
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: 'white',
          drawerLabelStyle: {
            fontSize: 16,
            marginLeft: -10,
            fontFamily: 'System', // fallback if Paper theme not ready
          },
          drawerIcon: ({ color }: { color: ColorValue }) => (
            <IconComponent name={iconData.name} size={20} color={color} />
          ),
        };
      }}
    />
  );
}