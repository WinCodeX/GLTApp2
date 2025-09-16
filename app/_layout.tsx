// app/_layout.tsx - Complete Stack Navigation System
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
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }}
                >
                  {/* MAIN DRAWER - Entry point */}
                  <Stack.Screen 
                    name="(drawer)" 
                    options={{ 
                      title: 'Home',
                      gestureEnabled: false,
                    }} 
                  />
                  
                  {/* MAIN APP SCREENS - All moved to root level */}
                  <Stack.Screen 
                    name="account" 
                    options={{ 
                      title: 'Account',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="business" 
                    options={{ 
                      title: 'Business',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="BusinessDetails" 
                    options={{ 
                      title: 'Business Details',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="settings" 
                    options={{ 
                      title: 'Settings',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="support" 
                    options={{ 
                      title: 'Support',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="track" 
                    options={{ 
                      title: 'Track Package',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="tracking" 
                    options={{ 
                      title: 'Package Tracking',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="faqs" 
                    options={{ 
                      title: 'FAQs',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="findus" 
                    options={{ 
                      title: 'Find Us',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="contact" 
                    options={{ 
                      title: 'Contact',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="history" 
                    options={{ 
                      title: 'History',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="cart" 
                    options={{ 
                      title: 'Cart',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="home" 
                    options={{ 
                      title: 'Home',
                      presentation: 'card'
                    }} 
                  />
                  
                  {/* MODAL SCREENS */}
                  <Stack.Screen 
                    name="notifications" 
                    options={{ 
                      title: 'Notifications',
                      presentation: 'modal',
                      animation: 'slide_from_bottom'
                    }} 
                  />
                  
                  {/* ADMIN SCREENS */}
                  <Stack.Screen 
                    name="admin" 
                    options={{ 
                      title: 'Admin Panel',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="AdminAppManager" 
                    options={{ 
                      title: 'App Manager',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="AdminNotifications" 
                    options={{ 
                      title: 'Notifications Management',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="AdminPackageSearch" 
                    options={{ 
                      title: 'Package Search',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="AdminScanning" 
                    options={{ 
                      title: 'Scanning',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="AdminTermsManagement" 
                    options={{ 
                      title: 'Terms Management',
                      presentation: 'card'
                    }} 
                  />
                  
                  {/* SETTINGS SUB-SCREENS */}
                  <Stack.Screen 
                    name="SettingsAppearance" 
                    options={{ 
                      title: 'Appearance',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsAccessibility" 
                    options={{ 
                      title: 'Accessibility',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsNotifications" 
                    options={{ 
                      title: 'Notification Settings',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsAdvanced" 
                    options={{ 
                      title: 'Advanced Settings',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsContentSocial" 
                    options={{ 
                      title: 'Content & Social',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsBugReport" 
                    options={{ 
                      title: 'Bug Report',
                      presentation: 'card'
                    }} 
                  />
                  <Stack.Screen 
                    name="SettingsAcknowledgements" 
                    options={{ 
                      title: 'Acknowledgements',
                      presentation: 'card'
                    }} 
                  />
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