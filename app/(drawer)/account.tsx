// app/(drawer)/account.tsx - Drawer Account Screen using Stack Navigation
import React, { useCallback } from 'react';
import AccountContent from '../../components/AccountContent';
import { useStackNavigation, useHardwareBackButton } from '../../lib/hooks/useStackNavigation';

export default function DrawerAccountScreen() {
  const { goBack } = useStackNavigation();

  // Handle hardware back button
  useHardwareBackButton('/(drawer)/');

  // Stack navigation back handler
  const handleBack = useCallback(() => {
    console.log('🔙 Drawer account: Going back with stack navigation...');
    goBack('/(drawer)/');
  }, [goBack]);

  return (
    <AccountContent
      source="drawer"
      onBack={handleBack}
      title="My Account"
    />
  );
}