// app/account.tsx - Root-level Account Screen for Stack Navigation
import React, { useCallback } from 'react';
import AccountContent from '../components/AccountContent';
import { useStackNavigation, useHardwareBackButton } from '../lib/hooks/useStackNavigation';

export default function AccountScreen() {
  const { goBack } = useStackNavigation();

  // Handle hardware back button
  useHardwareBackButton('/(drawer)/');

  // Stack navigation back handler
  const handleBack = useCallback(() => {
    console.log('🔙 Root account: Going back with stack navigation...');
    goBack('/(drawer)/');
  }, [goBack]);

  return (
    <AccountContent
      source="stack"
      onBack={handleBack}
      title="My Account"
    />
  );
}