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

const loadBusinesses = async () => {
try {
const seen = await AsyncStorage.getItem(CHANGELOG_KEY);
if (!seen) setShowChangelog(true);
const data = await getBusinesses();
setOwnedBusinesses(data?.owned || []);
setJoinedBusinesses(data?.joined || []);
} catch {
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

return (
<SafeAreaView style={styles.container}>
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
</Modal>      )}

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

<View style={styles.headerRow}>          
  <TouchableOpacity onPress={() => router.back()}>          
    <MaterialCommunityIcons name="arrow-left" size={24} color="#bd93f9" />          
  </TouchableOpacity>          
  <Text style={styles.header}>Account</Text>          
</View>          <View style={styles.identityCard}>          
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
</View>          <View style={styles.identityCard}>          
  <Text style={styles.userName}>Business</Text>          
  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>          
    <Button mode="outlined" onPress={() => setShowBusinessModal(true)}>Create</Button>          
    <Button mode="outlined" onPress={() => setShowJoinModal(true)}>Join</Button>          
  </View>          
</View>          <View style={styles.identityCard}>          
  <Text style={styles.userName}>Your Businesses</Text>          <Text style={styles.teamLabel}>Owned:</Text>
{ownedBusinesses.length > 0 ? (
ownedBusinesses.map((biz) => (
<TouchableOpacity key={biz.id} onPress={() => setSelectedBusiness(biz)}>
<Text style={styles.businessItem}>• {biz.name}</Text>
</TouchableOpacity>
))
) : (
<Text style={styles.businessItem}>None</Text>
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

<View style={styles.logoutCard}>          
  <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>          
    <MaterialCommunityIcons name="logout" size={22} color="#ff6b6b" />          
    <Text style={styles.logoutText}>Log Out</Text>          
  </TouchableOpacity>          
</View>          <Portal>          
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
      <Button onPress={() => setShowLogoutConfirm(false)} style={styles.dialogCancel}>No</Button>          
      <Button mode="outlined" onPress={confirmLogout} style={styles.dialogConfirm}>Yes</Button>          
    </Dialog.Actions>          
  </Dialog>          
</Portal>        </ScrollView>          
</SafeAreaView>  );      
}      const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: '#0e0e11' },
headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
header: { fontSize: 22, fontWeight: 'bold', color: '#bd93f9' },
identityCard: { backgroundColor: '#282a36', margin: 16, borderRadius: 12, padding: 16 },
identityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
accountType: { color: '#888', fontSize: 14, marginTop: 4 },
version: { color: '#999', marginTop: 4 },
teamLabel: { color: '#ccc', marginTop: 8, fontWeight: '600' },
businessItem: { color: '#fff', marginTop: 4, fontSize: 15 },
logoutCard: { backgroundColor: '#282a36', margin: 16, borderRadius: 12, padding: 12 },
logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 12 },
logoutText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600' },
dialog: { backgroundColor: '#282a36', borderRadius: 12 },
dialogTitle: { color: '#f8f8f2', fontWeight: 'bold' },
dialogText: { color: '#ccc', fontSize: 15 },
dialogActions: { justifyContent: 'space-between', paddingHorizontal: 12 },
dialogCancel: { backgroundColor: '#bd93f9', borderRadius: 6, marginRight: 8 },
dialogConfirm: { borderColor: '#ff5555', borderWidth: 1, borderRadius: 6 },
error: { color: '#ff5555', padding: 20, textAlign: 'center' },
modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
inviteModal: { backgroundColor: '#282a36', margin: 32, padding: 20, borderRadius: 12, alignItems: 'center' },
modalText: { color: '#fff', fontSize: 16, marginBottom: 12, textAlign: 'center' },
code: { color: '#bd93f9', fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 12 },
});

