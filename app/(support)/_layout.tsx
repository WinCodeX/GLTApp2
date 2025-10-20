// app/(support)/_layout.tsx - Support Section Layout
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function SupportLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#5A2D82" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B141B' },
          animation: 'none',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'GLT Support',
            gestureEnabled: false 
          }} 
        />
        <Stack.Screen 
          name="chat/[id]" 
          options={{ 
            title: 'Support Chat',
            gestureEnabled: true 
          }} 
        />
        <Stack.Screen 
          name="updates" 
          options={{ 
            title: 'Updates',
            gestureEnabled: true 
          }} 
        />
        <Stack.Screen 
          name="calls" 
          options={{ 
            title: 'Calls',
            gestureEnabled: true 
          }} 
        />
        <Stack.Screen 
          name="account" 
          options={{ 
            title: 'Account',
            gestureEnabled: true 
          }} 
        />
      </Stack>
    </>
  );
}