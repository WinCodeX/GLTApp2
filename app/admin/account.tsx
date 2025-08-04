// app/admin/account.tsx - Admin version
import React from 'react';
import { useRouter } from 'expo-router';
import AccountContent from '../../components/AccountContent';

export default function AdminAccountScreen() {
  const router = useRouter();

  const handleBack = () => {
    console.log('🔙 Admin account: navigating back to admin dashboard');
    
    try {
      if (router.canGoBack && router.canGoBack()) {
        console.log('✅ Using router.back()');
        router.back();
      } else {
        console.log('🏠 No back history, using router.replace(/admin)');
        router.replace('/admin');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Ultimate fallback
      router.replace('/admin');
    }
  };

  return (
    <AccountContent
      source="admin"
      onBack={handleBack}
      title="Admin Account"
    />
  );
}