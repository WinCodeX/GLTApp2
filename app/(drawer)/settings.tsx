// app/settings.tsx - Updated with Updates Section and Toast Messages
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAppNavigation, useHardwareBackButton, useStackNavigation } from '../../lib/hooks/useStackNavigation';
import UpdateService from '../../lib/services/updateService';

const SETTINGS_SECTIONS = [
  {
    title: 'Account Settings',
    data: [
      { id: '1', label: 'Account', icon: 'account-circle', route: '/account', type: 'navigate' },
      { id: '2', label: 'Content & Social', icon: 'group', route: '/SettingsContentSocial', type: 'navigate' },
    ],
  },
  {
    title: 'App Settings',
    data: [
      { id: '3', label: 'Appearance', icon: 'color-lens', route: '/SettingsAppearance', type: 'navigate' },
      { id: '4', label: 'Accessibility', icon: 'accessibility', route: '/SettingsAccessibility', type: 'navigate' },
      { id: '5', label: 'Notifications', icon: 'notifications', route: '/SettingsNotifications', type: 'navigate' },
      { id: '6', label: 'Advanced', icon: 'settings', route: '/SettingsAdvanced', type: 'navigate' },
    ],
  },
  {
    title: 'Support',
    data: [
      { id: '9', label: 'Support', icon: 'help-circle', route: '/support', type: 'navigate' },
      { id: '10', label: 'Upload any Bugs you find to GLT Support', icon: 'file-upload', route: '/SettingsBugReport', type: 'navigate' },
      { id: '11', label: 'Acknowledgements', icon: 'info', route: '/SettingsAcknowledgements', type: 'navigate' },
    ],
  },
  {
    title: 'Updates',
    data: [
      { id: '12', label: 'Check for Updates', icon: 'system-update', type: 'action', action: 'checkUpdates' },
    ],
  },
];

export default function SettingsScreen() {
  const [search, setSearch] = useState('');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  
  const { goBack, push } = useStackNavigation();
  const navigation = useAppNavigation();
  const updateService = UpdateService.getInstance();
  
  useHardwareBackButton('/(drawer)/');

  // Load current version on mount
  React.useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await updateService.getCurrentAPKVersion();
        setCurrentVersion(version);
      } catch (error) {
        console.error('Failed to load version:', error);
      }
    };
    loadVersion();
  }, []);

  const handleGoBack = useCallback(() => {
    console.log('🔙 Settings: Going back...');
    goBack('/(drawer)/');
  }, [goBack]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const iconMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
    };

    Alert.alert(
      `${iconMap[type]} ${title}`,
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: true }
    );
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (isCheckingUpdates) {
      showToast('Update Check', 'Update check already in progress...', 'info');
      return;
    }

    try {
      setIsCheckingUpdates(true);
      console.log('🔄 Settings: Checking for updates...');

      // Check if updates are supported
      if (!updateService.isUpdateSupported()) {
        showToast(
          'Updates Not Supported',
          'Your device or platform does not support automatic updates. Please check the app store manually.',
          'error'
        );
        return;
      }

      // Initialize update service if needed
      await updateService.initialize();

      // Check for updates
      const result = await updateService.checkForUpdates();

      if (result.hasUpdate && result.metadata) {
        const { metadata } = result;
        const isOTA = metadata.update_type === 'ota';
        const updateType = isOTA ? 'OTA (JavaScript)' : 'APK';
        
        const changelogText = metadata.changelog?.join('\n• ') || 'Bug fixes and improvements';
        const sizeText = metadata.file_size ? ` (${formatFileSize(metadata.file_size)})` : '';

        Alert.alert(
          `${metadata.force_update ? '⚠️ Required Update' : '🎉 Update Available'}`,
          `${updateType} Update - Version ${metadata.version}${sizeText}\n\n` +
          `What's New:\n• ${changelogText}\n\n` +
          `${isOTA ? 'This will update your app instantly without changing the APK version.' : 'This will download and install a new APK file.'}`,
          [
            ...(metadata.force_update ? [] : [
              {
                text: 'Later',
                style: 'cancel',
                onPress: () => showToast('Update Postponed', 'You can check for updates anytime from Settings.', 'info'),
              }
            ]),
            {
              text: isOTA ? 'Update Now' : 'Download',
              onPress: () => handleInstallUpdate(metadata),
            }
          ],
          { cancelable: !metadata.force_update }
        );
      } else {
        showToast(
          'You\'re Up to Date!',
          `GLT version ${currentVersion} is the latest version available. No updates needed.`,
          'success'
        );
      }
    } catch (error: any) {
      console.error('❌ Settings: Update check failed:', error);
      
      // Provide specific error messages based on error type
      let errorTitle = 'Update Check Failed';
      let errorMessage = 'An unexpected error occurred while checking for updates.';

      if (error.message?.includes('Network')) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the update server. Please check your internet connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorTitle = 'Connection Timeout';
        errorMessage = 'The update server is taking too long to respond. Please try again later.';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorTitle = 'Authentication Error';
        errorMessage = 'Unable to authenticate with the update server. Please log out and log back in, then try again.';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Update Not Found';
        errorMessage = 'The update information could not be found on the server. Please try again later.';
      } else if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
        errorTitle = 'Server Error';
        errorMessage = 'The update server is currently experiencing issues. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      showToast(errorTitle, errorMessage, 'error');
    } finally {
      setIsCheckingUpdates(false);
      console.log('✅ Settings: Update check completed');
    }
  }, [isCheckingUpdates, currentVersion, showToast, updateService]);

  const handleInstallUpdate = async (metadata: any) => {
    try {
      setIsCheckingUpdates(true);

      if (metadata.update_type === 'ota') {
        console.log('🔄 Settings: Installing OTA update...');
        showToast('Installing Update', 'Applying OTA update... The app will reload automatically.', 'info');
        
        await updateService.installUpdate(metadata);
        // App reloads automatically after OTA
      } else {
        console.log('⬇️ Settings: Downloading APK update...');
        showToast('Downloading Update', 'Starting download... You will be notified when ready to install.', 'info');
        
        const success = await updateService.downloadUpdate(metadata);
        
        if (success) {
          showToast(
            'Download Complete',
            `GLT version ${metadata.version} is ready to install. Tap the notification to install now.`,
            'success'
          );
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (error: any) {
      console.error('❌ Settings: Update installation failed:', error);
      
      let errorTitle = 'Installation Failed';
      let errorMessage = 'Failed to install the update.';

      if (error.message?.includes('storage') || error.message?.includes('space')) {
        errorTitle = 'Insufficient Storage';
        errorMessage = 'Not enough storage space to download the update. Please free up some space and try again.';
      } else if (error.message?.includes('permission')) {
        errorTitle = 'Permission Denied';
        errorMessage = 'Unable to install updates. Please grant the necessary permissions in Settings and try again.';
      } else if (error.message?.includes('Download failed')) {
        errorTitle = 'Download Failed';
        errorMessage = 'Failed to download the update file. Please check your internet connection and try again.';
      } else if (error.message?.includes('OTA update not available')) {
        errorTitle = 'OTA Not Available';
        errorMessage = 'OTA updates are not available in this build. Please use APK update instead.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      showToast(errorTitle, errorMessage, 'error');
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSettingNavigation = useCallback((item: any) => {
    console.log('🔧 Settings: Handling item:', item.label, 'Type:', item.type);
    
    try {
      if (item.type === 'action') {
        // Handle action items (like Check for Updates)
        switch (item.action) {
          case 'checkUpdates':
            handleCheckForUpdates();
            break;
          default:
            console.warn('Unknown action:', item.action);
        }
      } else {
        // Handle navigation items
        push(item.route);
        console.log('✅ Settings: Successfully navigated to:', item.route);
      }
    } catch (error) {
      console.error('❌ Settings: Action/Navigation failed for:', item.label, error);
      showToast('Error', `Failed to ${item.type === 'action' ? 'perform action' : 'navigate'}: ${item.label}`, 'error');
    }
  }, [push, handleCheckForUpdates, showToast]);

  const filterSettings = (sections: any) => {
    if (!search) return sections;

    return sections.map((section: any) => ({
      ...section,
      data: section.data.filter((item: any) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter((section: any) => section.data.length > 0);
  };

  const renderSection = ({ section }) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionHeader}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.data.map((item, index) => (
          <View key={item.id}>
            <View style={styles.settingItemContainer}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => handleSettingNavigation(item)}
                activeOpacity={0.7}
                disabled={item.type === 'action' && isCheckingUpdates}
              >
                <MaterialIcons name={item.icon} size={24} color="#fff" />
                <Text style={styles.settingText}>{item.label}</Text>
                {item.type === 'action' && isCheckingUpdates ? (
                  <ActivityIndicator size="small" color="#7c3aed" />
                ) : (
                  <Feather name="chevron-right" size={20} color="#888" />
                )}
              </TouchableOpacity>
            </View>
            {index < section.data.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </View>
      {section.title === 'Updates' && currentVersion && (
        <Text style={styles.versionText}>Current Version: {currentVersion}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c1d95', '#7c3aed', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchBar}
            placeholder="Search settings..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <SectionList
        sections={filterSettings(SETTINGS_SECTIONS)}
        keyExtractor={(item) => item.id}
        renderItem={() => null}
        renderSectionHeader={renderSection}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  placeholder: {
    width: 44,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 32,
    marginBottom: 12,
    opacity: 0.9,
  },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.6)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  settingItemContainer: {
    backgroundColor: 'transparent',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 16,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    marginLeft: 60,
<<<<<<< HEAD
=======
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
    fontStyle: 'italic',
>>>>>>> a6233a0 (OTA fix)
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
    fontStyle: 'italic',
  },
});
