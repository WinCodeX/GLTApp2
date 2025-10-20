// app/(support)/_layout.tsx - Support Section Layout
import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function SupportLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#5A2D82" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          contentStyle: { backgroundColor: '#0B141B' },
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'GLT Support',
            href: '/(support)',
          }} 
        />
        <Tabs.Screen 
          name="updates" 
          options={{ 
            title: 'Updates',
            href: '/(support)/updates',
          }} 
        />
        <Tabs.Screen 
          name="calls" 
          options={{ 
            title: 'Calls',
            href: '/(support)/calls',
          }} 
        />
        <Tabs.Screen 
          name="account" 
          options={{ 
            title: 'Account',
            href: '/(support)/account',
          }} 
        />
        <Tabs.Screen 
          name="chat/[id]" 
          options={{ 
            title: 'Support Chat',
            href: null,
          }} 
        />
      </Tabs>
    </>
  );
}