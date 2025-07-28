import {
  DarkTheme as NavigationDarkTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import {
  Feather,
  Ionicons,
  MaterialIcons,
  FontAwesome5,
} from '@expo/vector-icons';
import React from 'react';
import { ColorValue, Dimensions } from 'react-native';

import colors from '@/theme/colors';
import CustomDrawerContent from '@/components/CustomDrawerContent';

const CustomDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: colors.background,
    card: colors.card,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

// Optional: fallback drawer icon for unknown routes
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
  const drawerWidth = Dimensions.get('window').width * 0.65; // ~65% of screen width

  return (
    <ThemeProvider value={CustomDarkTheme}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={({ route }) => {
          const iconData = drawerIcons[route.name] || { name: 'circle', lib: Feather };
          const IconComponent = iconData.lib;

          return {
            headerShown: false,
            drawerStyle: {
              backgroundColor: colors.background,
              width: drawerWidth, // 👈 limit drawer width here
            },
            drawerActiveTintColor: colors.primary,
            drawerInactiveTintColor: 'white',
            drawerLabelStyle: {
              fontSize: 16,
              marginLeft: -10,
            },
            drawerIcon: ({ color }: { color: ColorValue }) => (
              <IconComponent name={iconData.name} size={20} color={color} />
            ),
          };
        }}
      />
    </ThemeProvider>
  );
}