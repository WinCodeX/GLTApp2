// app/(drawer)/account.tsx - Fixed Drawer Account Screen with Enhanced Navigation
import React, { useCallback } from 'react';
import AccountContent from '../../components/AccountContent';

// Import Enhanced NavigationHelper
import { NavigationHelper } from '../../lib/helpers/navigation';

export default function DrawerAccountScreen() {
  
  // Enhanced back navigation handler
  const handleBack = useCallback(async () => {
    console.log('🔙 Drawer account: navigating back with enhanced navigation...');
    
    try {
      const success = await NavigationHelper.goBack({
        fallbackRoute: '/(drawer)/',
        replaceIfNoHistory: true
      });
      
      if (success) {
        console.log('✅ Drawer account: Successfully navigated back to previous screen');
      } else {
        console.log('🏠 Drawer account: Used fallback navigation to drawer home');
      }
    } catch (error) {
      console.error('❌ Drawer account: Navigation error:', error);
      
      // Ultimate fallback using NavigationHelper
      try {
        await NavigationHelper.replaceTo('/(drawer)/');
        console.log('🔄 Drawer account: Used ultimate fallback to drawer home');
      } catch (fallbackError) {
        console.error('❌ Drawer account: Even fallback navigation failed:', fallbackError);
      }
    }
  }, []);

  return (
    <AccountContent
      source="drawer"
      onBack={handleBack}
      title="My Account"
    />
  );
}