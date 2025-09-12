import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import GLTHeader from '../../components/GLTHeader';
import { NavigationHelper } from '../../lib/helpers/navigation';
import api from '../../lib/api';

interface Contact {
  id: string;
  name: string;
  phoneNumbers: Array<{ number: string }>;
  imageUri?: string;
  primaryPhone: string;
  section?: string;
}

interface SectionHeader {
  type: 'header';
  id: string;
  title: string;
  count: number;
}

type ListItem = Contact | SectionHeader;

const ContactsScreen = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [registeredNumbers, setRegisteredNumbers] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [checkingRegistered, setCheckingRegistered] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Image,
          ],
        });

        // Process contacts and remove duplicates
        const processedContacts: Contact[] = data
          .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
          .map(contact => ({
            id: contact.id,
            name: contact.name || 'Unknown',
            phoneNumbers: contact.phoneNumbers,
            imageUri: contact.imageUri,
            // Get the first phone number for primary display
            primaryPhone: contact.phoneNumbers[0]?.number?.replace(/\s+/g, '') || '',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setContacts(processedContacts);
        
        // Check which contacts are registered in your app
        await checkRegisteredContactsApi(processedContacts);
        
      } else {
        Alert.alert('Permission Required', 'Please grant contacts permission to continue.');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const checkRegisteredContactsApi = async (contactList: Contact[]) => {
    try {
      setCheckingRegistered(true);
      
      // Extract all phone numbers from contacts
      const phoneNumbers = contactList.reduce<string[]>((acc, contact) => {
        contact.phoneNumbers.forEach(phone => {
          const cleanNumber = phone.number?.replace(/\D/g, ''); // Remove non-digits
          if (cleanNumber) acc.push(cleanNumber);
        });
        return acc;
      }, []);

      console.log('Checking registered contacts for phone numbers:', phoneNumbers.length);

      // Call your Rails backend
      const response = await api.post('/api/v1/contacts/check_registered', {
        phone_numbers: phoneNumbers
      });

      if (response.data && response.data.success) {
        setRegisteredNumbers(new Set(response.data.registered_numbers || []));
        console.log('Found registered numbers:', response.data.registered_numbers?.length || 0);
      }
      
    } catch (error) {
      console.error('Error checking registered contacts:', error);
      Alert.alert('Error', 'Failed to check registered contacts');
    } finally {
      setCheckingRegistered(false);
    }
  };

  const filterContacts = () => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumbers.some(phone =>
        phone.number?.includes(searchQuery)
      )
    );
    
    setFilteredContacts(filtered);
  };

  const isContactRegistered = (contact: Contact) => {
    return contact.phoneNumbers.some(phone => {
      const cleanNumber = phone.number?.replace(/\D/g, '');
      return cleanNumber && registeredNumbers.has(cleanNumber);
    });
  };

  const handleContactPress = (contact: Contact) => {
    if (isContactRegistered(contact)) {
      // Navigate to chat or user profile
      Alert.alert('GLT User', `${contact.name} is on GLT! Chat feature coming soon.`);
    } else {
      // Show invite options
      Alert.alert(
        'Invite to GLT',
        `${contact.name} is not on GLT. Would you like to invite them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Invite via SMS', 
            onPress: () => inviteViaSMS(contact.primaryPhone) 
          },
        ]
      );
    }
  };

  const inviteViaSMS = (phoneNumber: string) => {
    const message = 'Hey! Join me on GLT for package deliveries - download it here: [YOUR_APP_STORE_LINK]';
    const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const isRegistered = isContactRegistered(item);
    
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleContactPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isRegistered && (
            <View style={styles.registeredIndicator}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            </View>
          )}
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>
            {item.primaryPhone}
          </Text>
          {!isRegistered && (
            <Text style={styles.inviteText}>Not on GLT - Tap to invite</Text>
          )}
        </View>
        
        <View style={styles.statusContainer}>
          {isRegistered ? (
            <View style={styles.registeredBadge}>
              <Text style={styles.registeredBadgeText}>GLT</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={() => inviteViaSMS(item.primaryPhone)}
            >
              <Text style={styles.inviteButtonText}>INVITE</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>({count})</Text>
    </View>
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    if ('type' in item && item.type === 'header') {
      return renderSectionHeader(item.title, item.count);
    }
    return renderContact({ item: item as Contact });
  };

  const getListData = (): ListItem[] => {
    const registeredContacts = filteredContacts.filter(contact => isContactRegistered(contact));
    const unregisteredContacts = filteredContacts.filter(contact => !isContactRegistered(contact));
    
    const sections: ListItem[] = [];
    
    // Add registered contacts section
    if (registeredContacts.length > 0) {
      sections.push({
        type: 'header',
        id: 'registered-header',
        title: 'Contacts on GLT',
        count: registeredContacts.length
      });
      sections.push(...registeredContacts.map(contact => ({ ...contact, section: 'registered' })));
    }
    
    // Add unregistered contacts section
    if (unregisteredContacts.length > 0) {
      sections.push({
        type: 'header',
        id: 'unregistered-header',
        title: 'Invite to GLT',
        count: unregisteredContacts.length
      });
      sections.push(...unregisteredContacts.map(contact => ({ ...contact, section: 'unregistered' })));
    }
    
    return sections;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={48} color="#a78bfa" />
      </View>
      <Text style={styles.emptyTitle}>No Contacts Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search.' : 'Grant contacts permission to see your contacts.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <GLTHeader 
          title="Contacts" 
          showBackButton={true}
          onBackPress={() => NavigationHelper.goBack()}
        />
        <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c084fc" />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GLTHeader 
        title="Contacts" 
        showBackButton={true}
        onBackPress={() => NavigationHelper.goBack()}
      />
      
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#a78bfa" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#a78bfa"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {checkingRegistered && (
            <ActivityIndicator size="small" color="#c084fc" style={styles.searchLoader} />
          )}
        </View>

        {/* Contact Count Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {filteredContacts.length} contacts
            {registeredNumbers.size > 0 && (
              <Text style={styles.summaryHighlight}>
                {' • '}{Array.from(registeredNumbers).length} on GLT
              </Text>
            )}
          </Text>
        </View>

        {/* Contacts List */}
        <FlatList
          data={getListData()}
          renderItem={renderItem}
          keyExtractor={(item) => 'type' in item ? item.id : item.id}
          style={styles.contactsList}
          contentContainerStyle={[
            styles.listContainer,
            getListData().length === 0 && styles.emptyListContainer
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b3d',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 16,
  },
  searchLoader: {
    marginLeft: 12,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  summaryText: {
    color: '#c4b5fd',
    fontSize: 14,
  },
  summaryHighlight: {
    color: '#c084fc',
    fontWeight: '600',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.3)',
  },
  sectionTitle: {
    color: '#c084fc',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    color: '#a78bfa',
    fontSize: 14,
    marginLeft: 8,
  },
  contactsList: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.2)',
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  avatarText: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: 'bold',
  },
  registeredIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1a1b3d',
    borderRadius: 10,
    padding: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    color: '#c4b5fd',
    fontSize: 14,
    marginTop: 2,
  },
  inviteText: {
    color: '#c084fc',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  registeredBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  registeredBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  inviteButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ContactsScreen;