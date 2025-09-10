// app/admin/AppManagerScreen.tsx - Fixed with upload progress and large file support
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '../../context/UserContext';
import api from '../../lib/api';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

interface AppUpdate {
  id: string;
  version: string;
  runtimeVersion: string;
  description?: string;
  changelog: string[];
  force_update: boolean;
  published: boolean;
  apk_url?: string;
  apk_size?: number;
  download_count: number;
  created_at: string;
  published_at?: string;
}

interface CreateUpdateFormData {
  version: string;
  runtimeVersion: string;
  description: string;
  changelog: string[];
  force_update: boolean;
  published: boolean;
  apkFile: DocumentPicker.DocumentPickerResult | null;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

const AppManagerScreen: React.FC = () => {
  const { user } = useUser();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<AppUpdate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Upload progress state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    speed: 0,
    remainingTime: 0,
  });
  const [uploadStartTime, setUploadStartTime] = useState<number>(0);
  
  // Form state
  const [formData, setFormData] = useState<CreateUpdateFormData>({
    version: '',
    runtimeVersion: '1.0.0',
    description: '',
    changelog: [''],
    force_update: false,
    published: false,
    apkFile: null,
  });

  // Stats state
  const [stats, setStats] = useState({
    totalUpdates: 0,
    publishedUpdates: 0,
    totalDownloads: 0,
    latestVersion: '1.0.0',
  });

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/updates');
      setUpdates(response.data || []);
      
      // Calculate stats
      const totalUpdates = response.data?.length || 0;
      const publishedUpdates = response.data?.filter((u: AppUpdate) => u.published).length || 0;
      const totalDownloads = response.data?.reduce((sum: number, u: AppUpdate) => sum + u.download_count, 0) || 0;
      const latestVersion = response.data?.[0]?.version || '1.0.0';
      
      setStats({
        totalUpdates,
        publishedUpdates,
        totalDownloads,
        latestVersion,
      });
    } catch (error) {
      console.error('Failed to fetch updates:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load app updates',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUpdates();
    setRefreshing(false);
  }, [fetchUpdates]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const pickAPKFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // We'll validate APK files manually
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Validate APK file
        if (!file.name.toLowerCase().endsWith('.apk')) {
          Alert.alert('Invalid File', 'Please select an APK file.');
          return;
        }

        // Check file size (250MB limit to match server config)
        const maxSize = 250 * 1024 * 1024; // 250MB
        if (file.size && file.size > maxSize) {
          Alert.alert('File Too Large', 'APK file must be less than 250MB.');
          return;
        }

        setFormData(prev => ({ ...prev, apkFile: result }));
        Toast.show({
          type: 'success',
          text1: 'File Selected',
          text2: `${file.name} (${formatFileSize(file.size || 0)})`,
        });
      }
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds)) return 'calculating...';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const calculateDynamicTimeout = (fileSize: number): number => {
    // Base timeout of 2 minutes, plus 3 seconds per MB, with max of 15 minutes
    const baseTimetout = 120000; // 2 minutes
    const perMBTimeout = 3000; // 3 seconds per MB
    const fileSizeMB = fileSize / (1024 * 1024);
    const calculatedTimeout = baseTimetout + (fileSizeMB * perMBTimeout);
    const maxTimeout = 900000; // 15 minutes
    
    return Math.min(calculatedTimeout, maxTimeout);
  };

  const createUpdate = async () => {
    try {
      // Validate form
      if (!formData.version.trim()) {
        Alert.alert('Error', 'Version is required');
        return;
      }

      if (!formData.changelog.some(item => item.trim())) {
        Alert.alert('Error', 'At least one changelog item is required');
        return;
      }

      setUploading(true);
      setShowProgressModal(true);
      setUploadStartTime(Date.now());

      // Reset progress
      setUploadProgress({
        loaded: 0,
        total: 0,
        percentage: 0,
        speed: 0,
        remainingTime: 0,
      });

      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('version', formData.version);
      uploadData.append('runtime_version', formData.runtimeVersion);
      uploadData.append('description', formData.description);
      uploadData.append('force_update', formData.force_update.toString());
      uploadData.append('published', formData.published.toString());
      
      // Add changelog items
      formData.changelog.forEach((item, index) => {
        if (item.trim()) {
          uploadData.append(`changelog[${index}]`, item.trim());
        }
      });

      // Calculate timeout based on file size
      const fileSize = formData.apkFile?.assets?.[0]?.size || 0;
      const timeoutMs = calculateDynamicTimeout(fileSize);

      // Add APK file if selected
      if (formData.apkFile && !formData.apkFile.canceled && formData.apkFile.assets) {
        const file = formData.apkFile.assets[0];
        uploadData.append('apk', {
          uri: file.uri,
          type: 'application/vnd.android.package-archive',
          name: file.name,
        } as any);
      }

      const response = await api.post('/api/v1/updates', uploadData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: timeoutMs,
        onUploadProgress: (progressEvent) => {
          const currentTime = Date.now();
          const elapsedTime = (currentTime - uploadStartTime) / 1000; // seconds
          const loaded = Math.max(0, progressEvent.loaded || 0);
          const total = Math.max(loaded, progressEvent.total || 0);
          
          // Clamp percentage between 0 and 100 to prevent display issues
          let percentage = 0;
          if (total > 0) {
            percentage = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
          }
          
          const speed = elapsedTime > 0 ? loaded / elapsedTime : 0;
          const remainingBytes = Math.max(0, total - loaded);
          const remainingTime = speed > 0 && remainingBytes > 0 ? remainingBytes / speed : 0;

          setUploadProgress({
            loaded,
            total,
            percentage,
            speed,
            remainingTime,
          });
        },
      });

      if (response.status === 201) {
        setShowProgressModal(false);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Update created successfully!',
        });
        
        setShowCreateModal(false);
        resetForm();
        fetchUpdates();
      }
    } catch (error: any) {
      console.error('Create update error:', error);
      setShowProgressModal(false);
      
      let message = 'Failed to create update';
      if (error.code === 'ECONNABORTED') {
        message = 'Upload timeout - file too large or connection too slow';
      } else if (error.response?.status === 413) {
        message = 'File too large for server. Try a smaller APK file.';
      } else if (error.response?.status === 408) {
        message = 'Upload timeout - try on a faster connection';
      } else if (error.response?.data?.details) {
        message = error.response.data.details;
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: message,
      });
    } finally {
      setUploading(false);
    }
  };

  const publishUpdate = async (updateId: string) => {
    try {
      await api.patch(`/api/v1/updates/${updateId}/publish`);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Update published successfully!',
      });
      fetchUpdates();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to publish update',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      version: '',
      runtimeVersion: '1.0.0',
      description: '',
      changelog: [''],
      force_update: false,
      published: false,
      apkFile: null,
    });
  };

  const addChangelogItem = () => {
    setFormData(prev => ({
      ...prev,
      changelog: [...prev.changelog, '']
    }));
  };

  const updateChangelogItem = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      changelog: prev.changelog.map((item, i) => i === index ? value : item)
    }));
  };

  const removeChangelogItem = (index: number) => {
    if (formData.changelog.length > 1) {
      setFormData(prev => ({
        ...prev,
        changelog: prev.changelog.filter((_, i) => i !== index)
      }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.statGradient}
        >
          <Ionicons name="apps" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.totalUpdates}</Text>
          <Text style={styles.statLabel}>Total Updates</Text>
        </LinearGradient>
      </View>
      
      <View style={styles.statCard}>
        <LinearGradient
          colors={['#f093fb', '#f5576c']}
          style={styles.statGradient}
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.publishedUpdates}</Text>
          <Text style={styles.statLabel}>Published</Text>
        </LinearGradient>
      </View>
      
      <View style={styles.statCard}>
        <LinearGradient
          colors={['#4facfe', '#00f2fe']}
          style={styles.statGradient}
        >
          <Ionicons name="download" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.totalDownloads}</Text>
          <Text style={styles.statLabel}>Downloads</Text>
        </LinearGradient>
      </View>
      
      <View style={styles.statCard}>
        <LinearGradient
          colors={['#43e97b', '#38f9d7']}
          style={styles.statGradient}
        >
          <Ionicons name="rocket" size={24} color="white" />
          <Text style={styles.statNumber}>v{stats.latestVersion}</Text>
          <Text style={styles.statLabel}>Latest</Text>
        </LinearGradient>
      </View>
    </View>
  );

  const renderUpdateCard = (update: AppUpdate) => (
    <TouchableOpacity
      key={update.id}
      style={styles.updateCard}
      onPress={() => {
        setSelectedUpdate(update);
        setShowDetailsModal(true);
      }}
    >
      <View style={styles.updateHeader}>
        <View>
          <Text style={styles.updateVersion}>v{update.version}</Text>
          <Text style={styles.updateRuntime}>Runtime: {update.runtimeVersion}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: update.published ? '#10b981' : '#f59e0b' }
          ]}>
            <Text style={styles.statusText}>
              {update.published ? 'Published' : 'Draft'}
            </Text>
          </View>
          {update.force_update && (
            <View style={[styles.statusBadge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.statusText}>Force</Text>
            </View>
          )}
        </View>
      </View>
      
      {update.description && (
        <Text style={styles.updateDescription} numberOfLines={2}>
          {update.description}
        </Text>
      )}
      
      <View style={styles.updateStats}>
        <View style={styles.statItem}>
          <Ionicons name="download-outline" size={16} color="#6b7280" />
          <Text style={styles.statText}>{update.download_count}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.statText}>{formatDate(update.created_at)}</Text>
        </View>
        {update.apk_size && (
          <View style={styles.statItem}>
            <Ionicons name="document-outline" size={16} color="#6b7280" />
            <Text style={styles.statText}>{formatFileSize(update.apk_size)}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.updateActions}>
        {!update.published && update.apk_url && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#10b981' }]}
            onPress={() => publishUpdate(update.id)}
          >
            <Ionicons name="rocket" size={16} color="white" />
            <Text style={styles.actionText}>Publish</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderProgressModal = () => (
    <Modal
      visible={showProgressModal}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.progressModalOverlay}>
        <View style={styles.progressModalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.progressModalHeader}
          >
            <Ionicons name="cloud-upload" size={32} color="white" />
            <Text style={styles.progressModalTitle}>Uploading APK</Text>
          </LinearGradient>
          
          <View style={styles.progressModalBody}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressPercentage}>{uploadProgress.percentage}%</Text>
              <Text style={styles.progressDetails}>
                {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={[styles.progressBarFill, { width: `${uploadProgress.percentage}%` }]}
                />
              </View>
            </View>
            
            <View style={styles.progressStats}>
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Speed</Text>
                <Text style={styles.progressStatValue}>{formatSpeed(uploadProgress.speed)}</Text>
              </View>
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Remaining</Text>
                <Text style={styles.progressStatValue}>{formatTime(uploadProgress.remainingTime)}</Text>
              </View>
            </View>
            
            <View style={styles.progressMessage}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.progressMessageText}>
                {uploadProgress.percentage < 100 ? 'Uploading to cloud storage...' : 'Processing upload...'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.modalHeader}
        >
          <View style={styles.modalHeaderContent}>
            <Text style={styles.modalTitle}>Create New Update</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Version Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Version Information</Text>
            
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Version Number *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.version}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, version: text }))}
                  placeholder="e.g., 1.3.8"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Runtime Version</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.runtimeVersion}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, runtimeVersion: text }))}
                  placeholder="1.0.0"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Brief description of this update..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
          
          {/* Changelog Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Changelog</Text>
              <TouchableOpacity onPress={addChangelogItem} style={styles.addButton}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
            
            {formData.changelog.map((item, index) => (
              <View key={index} style={styles.changelogItem}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={item}
                  onChangeText={(text) => updateChangelogItem(index, text)}
                  placeholder="Enter changelog item..."
                  placeholderTextColor="#9ca3af"
                />
                {formData.changelog.length > 1 && (
                  <TouchableOpacity 
                    onPress={() => removeChangelogItem(index)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
          
          {/* APK Upload Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>APK File</Text>
            
            <TouchableOpacity 
              style={styles.filePickerButton}
              onPress={pickAPKFile}
            >
              <LinearGradient
                colors={['#6c5ce7', '#a29bfe']}
                style={styles.filePickerGradient}
              >
                <Ionicons name="cloud-upload" size={24} color="white" />
                <Text style={styles.filePickerText}>
                  {formData.apkFile ? 'Change APK File' : 'Select APK File'}
                </Text>
                {formData.apkFile && !formData.apkFile.canceled && formData.apkFile.assets && (
                  <Text style={styles.filePickerSubtext}>
                    {formData.apkFile.assets[0].name}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            {formData.apkFile?.assets?.[0] && (
              <View style={styles.fileInfo}>
                <Text style={styles.fileInfoText}>
                  Size: {formatFileSize(formData.apkFile.assets[0].size || 0)}
                </Text>
                <Text style={styles.fileInfoText}>
                  Estimated upload time: {formatTime(calculateDynamicTimeout(formData.apkFile.assets[0].size || 0) / 1000)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Options Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Options</Text>
            
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setFormData(prev => ({ ...prev, force_update: !prev.force_update }))}
            >
              <View style={[styles.checkbox, formData.force_update && styles.checkboxChecked]}>
                {formData.force_update && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={styles.checkboxLabel}>Force Update (users must install)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setFormData(prev => ({ ...prev, published: !prev.published }))}
            >
              <View style={[styles.checkbox, formData.published && styles.checkboxChecked]}>
                {formData.published && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={styles.checkboxLabel}>Publish immediately</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => setShowCreateModal(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.createButton}
            onPress={createUpdate}
            disabled={uploading}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.createButtonGradient}
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="rocket" size={16} color="white" />
                  <Text style={styles.createButtonText}>Create Update</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderDetailsModal = () => (
    <Modal
      visible={showDetailsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedUpdate && (
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalHeader}
          >
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle}>Update v{selectedUpdate.version}</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Version:</Text>
                <Text style={styles.detailValue}>{selectedUpdate.version}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Runtime:</Text>
                <Text style={styles.detailValue}>{selectedUpdate.runtimeVersion}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={[styles.detailValue, { 
                  color: selectedUpdate.published ? '#10b981' : '#f59e0b' 
                }]}>
                  {selectedUpdate.published ? 'Published' : 'Draft'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Force Update:</Text>
                <Text style={styles.detailValue}>
                  {selectedUpdate.force_update ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
            
            {selectedUpdate.description && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsTitle}>Description</Text>
                <Text style={styles.descriptionText}>{selectedUpdate.description}</Text>
              </View>
            )}
            
            {selectedUpdate.changelog.length > 0 && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsTitle}>Changelog</Text>
                {selectedUpdate.changelog.map((item, index) => (
                  <View key={index} style={styles.changelogDetailItem}>
                    <Text style={styles.changelogBullet}>•</Text>
                    <Text style={styles.changelogText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Statistics</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Downloads:</Text>
                <Text style={styles.detailValue}>{selectedUpdate.download_count}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedUpdate.created_at)}</Text>
              </View>
              {selectedUpdate.published_at && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Published:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedUpdate.published_at)}</Text>
                </View>
              )}
              {selectedUpdate.apk_size && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File Size:</Text>
                  <Text style={styles.detailValue}>{formatFileSize(selectedUpdate.apk_size)}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading app updates...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        style={styles.background}
      >
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>App Manager</Text>
          <Text style={styles.headerSubtitle}>Manage your app updates and deployments</Text>
        </LinearGradient>

        {/* Stats Cards */}
        {renderStatsCards()}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.createButtonGradient}
            >
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.createButtonText}>Create Update</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Updates List */}
        <ScrollView 
          style={styles.updatesContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {updates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="phone-portrait-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No Updates Found</Text>
              <Text style={styles.emptySubtitle}>
                Create your first app update to get started
              </Text>
            </View>
          ) : (
            updates.map(renderUpdateCard)
          )}
        </ScrollView>

        {/* Modals */}
        {renderCreateModal()}
        {renderDetailsModal()}
        {renderProgressModal()}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statGradient: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  actionBar: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  createButton: {
    alignSelf: 'flex-end',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 5,
  },
  updatesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  updateCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  updateVersion: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  updateRuntime: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  updateDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 15,
    lineHeight: 20,
  },
  updateStats: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  updateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 15,
  },
  formRow: {
    flexDirection: 'row',
    gap: 15,
  },
  formField: {
    flex: 1,
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  removeButton: {
    padding: 8,
  },
  filePickerButton: {
    marginBottom: 10,
  },
  filePickerGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  filePickerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  filePickerSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  fileInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  fileInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 25,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  changelogDetailItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  changelogBullet: {
    fontSize: 16,
    color: '#667eea',
    marginRight: 8,
    fontWeight: 'bold',
  },
  changelogText: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
    lineHeight: 20,
  },
  // Progress Modal Styles
  progressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  progressModalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  progressModalHeader: {
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  progressModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  progressModalBody: {
    padding: 25,
  },
  progressInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  progressDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressStatItem: {
    alignItems: 'center',
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 5,
  },
  progressStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  progressMessageText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 10,
  },
});

export default AppManagerScreen;