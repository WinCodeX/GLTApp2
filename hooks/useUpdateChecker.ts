import { useState, useEffect } from 'react';
import UpdateService from '../lib/services/updateService';

export const useUpdateChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      const updateService = UpdateService.getInstance();
      const result = await updateService.checkForUpdates();
      
      setUpdateAvailable(result.hasUpdate);
      setUpdateInfo(result.metadata || null);
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  return {
    updateAvailable,
    updateInfo,
    isChecking,
    checkForUpdates
  };
};