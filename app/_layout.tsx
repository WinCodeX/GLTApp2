// app/_layout.tsx
import React from 'react';
import { Slot } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';

import { UserProvider } from '@/context/UserContext';
import colors from '@/theme/colors';

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

export default function Layout() {
  return (
    <PaperProvider>
      <ThemeProvider value={CustomDarkTheme}>
        <UserProvider>
          <Slot />
        </UserProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}