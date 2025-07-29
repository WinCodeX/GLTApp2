import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, Button, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AvatarPreviewModal from '../../components/AvatarPreviewModal';
import BusinessModal from '../../components/BusinessModal';
import ChangelogModal, {
  CHANGELOG_KEY,
  CHANGELOG_VERSION,
} from '../../components/ChangelogModal';
import JoinBusinessModal from '../../components/JoinBusinessModal';
import LoaderOverlay from '../../components/LoaderOverlay';
import { useUser } from '../../context/UserContext';
import { createInvite, getBusinesses } from '../../lib/helpers/business';
import { uploadAvatar } from '../../lib/helpers/uploadAvatar';
import colors from '../../theme/colors';

export default function AccountScreen() {
  const { user, refreshUser, loading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const navigation = useNavigation();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () =>
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
  }, [navigation]);

  const reloadFullProfile = async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      await refreshUser();
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
    setRefreshing(false);
  };

  const pickAndPreviewAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Toast.show({
        type: 'warningToast',
        text1: 'Photo access denied.',
      });
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

  const dismissChangelog = async () => {
    await AsyncStorage.setItem(CHANGELOG_KEY, 'true');
    setShowChangelog(false);
  };

  return (
    <SafeAreaView style={styles.container}>
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#bd93f9']}
          />
        }
      >
        {/* Top Profile Section */}
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

        {/* Account Info Block */}
        <View style={styles.identityCard}>
          <Text style={styles.infoHeader}>Account Information</Text>

          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{user?.username || '—'}</Text>

          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || '—'}</Text>

          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user?.phone || '—'}</Text>

          <Text style={styles.infoLabel}>Password</Text>
          <Button
            mode="outlined"
            onPress={() => router.push('/change-password')}
            style={{ marginTop: 8 }}
          >
            Change Password
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  identityCard: {
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  accountType: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  version: {
    color: '#999',
    marginTop: 4,
  },
  infoHeader: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
});