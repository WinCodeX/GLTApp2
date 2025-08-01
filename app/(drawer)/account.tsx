import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Avatar, Button, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AvatarPreviewModal from '../../components/AvatarPreviewModal';
import BusinessModal from '../../components/BusinessModal';
import ChangelogModal, { CHANGELOG_KEY, CHANGELOG_VERSION } from '../../components/ChangelogModal';
import JoinBusinessModal from '../../components/JoinBusinessModal';
import LoaderOverlay from '../../components/LoaderOverlay';
import { useUser } from '../../context/UserContext';
import { createInvite, getBusinesses } from '../../lib/helpers/business';
import { uploadAvatar } from '../../lib/helpers/uploadAvatar';

export default function AccountScreen() {
  const { user, refreshUser, loading: userLoading, error: userError } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState([]);
  const [joinedBusinesses, setJoinedBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const navigation = useNavigation();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
  }, [navigation]);

  // Load businesses and handle changelog display
  const loadBusinesses = async () => {
    try {
      const seen = await AsyncStorage.getItem(CHANGELOG_KEY);
      if (!seen) setShowChangelog(true);
      
      const data = await getBusinesses();
      setOwnedBusinesses(data?.owned || []);
      setJoinedBusinesses(data?.joined || []);
    } catch (error) {
      console.log('Error loading businesses:', error);
      Toast.show({ type: 'errorToast', text1: 'Failed to load businesses.' });
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
    }
  };

  const reloadFullProfile = async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      await refreshUser();
      await loadBusinesses();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    reloadFullProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await loadBusinesses();
    setRefreshing(false);
  };

  const pickAndPreviewAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Toast.show({ type: 'warningToast', text1: 'Photo access denied.' });
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;
    setPreviewUri(result.assets[0].uri);
  };

  const confirmUploadAvatar = async () => {
    if (!previewUri) return;

    try {
      await uploadAvatar(previewUri);
      Toast.show({ type: 'successToast', text1: 'Avatar updated!' });
      await reloadFullProfile();
    } catch {
      Toast.show({ type: 'errorToast', text1: 'Upload failed.' });
    } finally {
      setPreviewUri(null);
    }
  };

  const confirmLogout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    Toast.show({ type: 'warningToast', text1: 'Logged out successfully' });
    setShowLogoutConfirm(false);
    router.replace('/login');
  };

  const dismissChangelog = async () => {
    await AsyncStorage.setItem(CHANGELOG_KEY, 'true');
    setShowChangelog(false);
  };

  // Handle back button press with better error handling
  const handleBackPress = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback navigation - adjust route as needed
        router.replace('/');
      }
    } catch (error) {
      console.log('Navigation error:', error);
      // Alternative fallback
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      {/* LoaderOverlay appears on top without blocking layout */}
      <LoaderOverlay visible={userLoading || loading} />

      {showChangelog && (
        <ChangelogModal visible onClose={dismissChangelog} />
      )}

      {previewUri && (
        <AvatarPreviewModal
          visible
          uri={previewUri}
          onCancel={() => setPreviewUri(null)}
          onConfirm={confirmUploadAvatar}
        />
      )}

      {showBusinessModal && (
        <BusinessModal
          visible
          onClose={() => setShowBusinessModal(false)}
          onCreate={reloadFullProfile}
        />
      )}

      {showJoinModal && (
        <JoinBusinessModal
          visible
          onClose={() => setShowJoinModal(false)}
          onJoin={reloadFullProfile}
        />
      )}

      {selectedBusiness && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.inviteModal}>
              <Text style={styles.modalText}>
                Generate invite link for "{selectedBusiness.name}"?
              </Text>

              {!inviteLink ? (
                <Button mode="contained" onPress={async () => {
                  try {
                    const res = await createInvite(selectedBusiness.id);
                    setInviteLink(res?.code || 'No code');
                  } catch {}
                }}>
                  Generate Link
                </Button>
              ) : (
                <>
                  <Text selectable style={styles.code}>{inviteLink}</Text>
                  <Button onPress={() => {
                    Clipboard.setStringAsync(inviteLink);
                    Toast.show({ type: 'successToast', text1: 'Copied to clipboard!' });
                  }}>
                    Copy
                  </Button>
                </>
              )}

              <Button onPress={() => {
                setSelectedBusiness(null);
                setInviteLink(null);
              }}>
                Close
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {/* Header with gradient background like settings screen */}
      <LinearGradient
        colors={['#4c1d95', '#7c3aed', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={handleBackPress}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Account</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
          />
        }
      >
        {/* User Profile Card */}
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View>
              <Text style={styles.userName}>{user?.username || 'No name'}</Text>
              <Text style={styles.accountType}>Glt Account</Text>
              <Text style={styles.version}>v{CHANGELOG_VERSION}</Text>
            </View>
            <TouchableOpacity onPress={pickAndPreviewAvatar}>
              <Avatar.Image
                size={60}
                source={
                  user?.avatar_url
                    ? { uri: user.avatar_url }
                    : require('../../assets/images/avatar_placeholder.png')
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-username')}>
            <Text style={styles.infoLabel}>Username</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.username || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-display-name')}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.display_name || 'LVL0'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-email')}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.email || 'admin@example.com'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-phone')}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Business Actions Card */}
        <View style={styles.identityCard}>
          <Text style={styles.userName}>Business</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button 
              mode="outlined" 
              onPress={() => setShowBusinessModal(true)}
              buttonColor="rgba(124, 58, 237, 0.1)"
              textColor="#7c3aed"
            >
              Create
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => setShowJoinModal(true)}
              buttonColor="rgba(124, 58, 237, 0.1)"
              textColor="#7c3aed"
            >
              Join
            </Button>
          </View>
        </View>

        {/* User Businesses Card */}
        <View style={styles.identityCard}>
          <Text style={styles.userName}>Your Businesses</Text>
          
          <Text style={styles.teamLabel}>Owned:</Text>
          {ownedBusinesses.length > 0 ? (
            ownedBusinesses.map((biz) => (
              <TouchableOpacity key={biz.id} onPress={() => setSelectedBusiness(biz)}>
                <Text style={styles.businessItem}>• {biz.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.businessItem}>• Infinity</Text>
          )}

          <Text style={styles.teamLabel}>Joined:</Text>
          {joinedBusinesses.length > 0 ? (
            joinedBusinesses.map((biz) => (
              <Text key={biz.id} style={styles.businessItem}>• {biz.name}</Text>
            ))
          ) : (
            <Text style={styles.businessItem}>None</Text>
          )}
        </View>

        {/* Logout Card */}
        <View style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
            <MaterialCommunityIcons name="logout" size={22} color="#ff6b6b" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Confirmation Dialog */}
        <Portal>
          <Dialog
            visible={showLogoutConfirm}
            onDismiss={() => setShowLogoutConfirm(false)}
            style={styles.dialog}
          >
            <Dialog.Title style={styles.dialogTitle}>Confirm Logout</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogText}>Are you sure you want to log out?</Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <Button onPress={() => setShowLogoutConfirm(false)} style={styles.dialogCancel}>
                No
              </Button>
              <Button mode="outlined" onPress={confirmLogout} style={styles.dialogConfirm}>
                Yes
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0f' // Darker background to match settings
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50, // Account for status bar
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
    fontStyle: 'italic', // Cursive-like style to match settings screen
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  placeholder: {
    width: 44, // Same width as back button for centering
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.6)', // Purple edge lighting
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
    borderBottomWidth: 1,
  },
  infoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    color: '#ccc',
    fontSize: 15,
  },
  identityCard: { 
    backgroundColor: '#1a1a2e',
    margin: 16, 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.6)', // Purple edge lighting
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  identityRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  userName: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  accountType: { 
    color: '#888', 
    fontSize: 14, 
    marginTop: 4 
  },
  version: { 
    color: '#999', 
    marginTop: 4 
  },
  teamLabel: { 
    color: '#ccc', 
    marginTop: 8, 
    fontWeight: '600' 
  },
  businessItem: { 
    color: '#fff', 
    marginTop: 4, 
    fontSize: 15 
  },
  logoutCard: { 
    backgroundColor: '#1a1a2e', 
    margin: 16, 
    borderRadius: 16, 
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.6)', // Red edge lighting for logout
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  logoutButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  logoutText: { 
    color: '#ff6b6b', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  dialog: { 
    backgroundColor: '#1a1a2e', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  dialogTitle: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },
  dialogText: { 
    color: '#ccc', 
    fontSize: 15 
  },
  dialogActions: { 
    justifyContent: 'space-between', 
    paddingHorizontal: 12 
  },
  dialogCancel: { 
    backgroundColor: '#7c3aed', 
    borderRadius: 6, 
    marginRight: 8 
  },
  dialogConfirm: { 
    borderColor: '#ff5555', 
    borderWidth: 1, 
    borderRadius: 6 
  },
  error: { 
    color: '#ff5555', 
    padding: 20, 
    textAlign: 'center' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  inviteModal: { 
    backgroundColor: '#1a1a2e', 
    margin: 32, 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalText: { 
    color: '#fff', 
    fontSize: 16, 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  code: { 
    color: '#7c3aed', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 12, 
    marginBottom: 12 
  },
});