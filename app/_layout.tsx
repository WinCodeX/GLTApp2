// app/_layout.tsx - Simplified Stack Navigation
import React from 'react';
import { Stack } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/lib/toastConfig';

import { UserProvider } from '@/context/UserContext';
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import NetworkBanner from '@/components/NetworkBanner';
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider value={CustomDarkTheme}>
            <UserProvider>
              <BluetoothProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'none', // No animations
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }}
                >
                  <Stack.Screen 
                    name="(drawer)" 
                    options={{ 
                      gestureEnabled: false,
                    }} 
                  />
                  
                  <Stack.Screen name="account" />
                  <Stack.Screen name="business" />
                  <Stack.Screen name="BusinessDetails" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="support" />
                  <Stack.Screen name="track" />
                  <Stack.Screen name="tracking" />
                  <Stack.Screen name="faqs" />
                  <Stack.Screen name="findus" />
                  <Stack.Screen name="contact" />
                  <Stack.Screen name="history" />
                  <Stack.Screen name="cart" />
                  <Stack.Screen name="home" />
                  
                  <Stack.Screen 
                    name="notifications" 
                    options={{ 
                      presentation: 'modal',
                    }} 
                  />
                  
                  <Stack.Screen name="admin" />
                  <Stack.Screen name="AdminAppManager" />
                  <Stack.Screen name="AdminNotifications" />
                  <Stack.Screen name="AdminPackageSearch" />
                  <Stack.Screen name="AdminScanning" />
                  <Stack.Screen name="AdminTermsManagement" />
                  
                  <Stack.Screen name="SettingsAppearance" />
                  <Stack.Screen name="SettingsAccessibility" />
                  <Stack.Screen name="SettingsNotifications" />
                  <Stack.Screen name="SettingsAdvanced" />
                  <Stack.Screen name="SettingsContentSocial" />
                  <Stack.Screen name="SettingsBugReport" />
                  <Stack.Screen name="SettingsAcknowledgements" />
                </Stack>
                
                <NetworkBanner headerHeight={60} />
              </BluetoothProvider>
            </UserProvider>
          </ThemeProvider>
        </PaperProvider>
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}