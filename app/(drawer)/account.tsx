// app/(drawer)/account.tsx - Drawer version (replaces your existing drawer account)
import React from 'react';
import { useRouter } from 'expo-router';
import AccountContent from '../../components/AccountContent';

export default function DrawerAccountScreen() {
  const router = useRouter();

  const handleBack = () => {
    console.log('🔙 Drawer account: navigating back to drawer home');
    
    try {
      if (router.canGoBack && router.canGoBack()) {
        console.log('✅ Using router.back() to drawer');
        router.back();
      } else {
        console.log('🏠 No back history, using router.replace(/(drawer))');
        router.replace('/(drawer)');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Ultimate fallback
      router.replace('/(drawer)');
    }
  };

  return (
    <AccountContent
      source="drawer"
      onBack={handleBack}
      title="My Account"
    />
  );
}