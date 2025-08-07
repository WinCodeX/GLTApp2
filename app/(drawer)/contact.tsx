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
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { checkRegisteredContacts, handleApiError } from '../../lib/api';

const ContactsScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [registeredNumbers, setRegisteredNumbers] = useState(new Set());
  const [loading, setLoading] = useState(true);

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
        const processedContacts = data
          .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
          .map(contact => ({
            id: contact.id,
            name: contact.name || 'Unknown',
            phoneNumbers: contact.phoneNumbers,
            imageUri: contact.imageUri,
            // Get the first phone number for primary display
            primaryPhone: contact.phoneNumbers[0]?.number?.replace(/\s+/g, ''),
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

  const checkRegisteredContactsApi = async (contactList) => {
    try {
      // Extract all phone numbers from contacts
      const phoneNumbers = contactList.reduce((acc, contact) => {
        contact.phoneNumbers.forEach(phone => {
          const cleanNumber = phone.number?.replace(/\D/g, ''); // Remove non-digits
          if (cleanNumber) acc.push(cleanNumber);
        });
        return acc;
      }, []);

      // Call your Rails backend using the imported API function
      const data = await checkRegisteredContacts(phoneNumbers);
      setRegisteredNumbers(new Set(data.registered_numbers || []));
      
    } catch (error) {
      const errorMessage = handleApiError(error, 'checking registered contacts');
      Alert.alert('Error', errorMessage);
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

  const isContactRegistered = (contact) => {
    return contact.phoneNumbers.some(phone => {
      const cleanNumber = phone.number?.replace(/\D/g, '');
      return registeredNumbers.has(cleanNumber);
    });
  };

  const handleContactPress = (contact) => {
    if (isContactRegistered(contact)) {
      // Navigate to chat or user profile
      navigation.navigate('Chat', { contact });
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

  const inviteViaSMS = (phoneNumber) => {
    const message = 'Hey! Join me on GLT - download it here: [YOUR_APP_STORE_LINK]';
    const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const renderContact = ({ item }) => {
    const isRegistered = isContactRegistered(item);
    
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleContactPress(item)}
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
              <Ionicons name="checkmark-circle" size={20} color="#7B2CBF" />
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

  const renderSectionHeaders = () => {
    const registeredContacts = filteredContacts.filter(contact => isContactRegistered(contact));
    const unregisteredContacts = filteredContacts.filter(contact => !isContactRegistered(contact));
    
    return {
      registeredContacts,
      unregisteredContacts
    };
  };

  const renderSectionHeader = (title, count) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>({count})</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7B2CBF" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Contacts Sections */}
      <FlatList
        data={(() => {
          const { registeredContacts, unregisteredContacts } = renderSectionHeaders();
          const sections = [];
          
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
        })()}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return renderSectionHeader(item.title, item.count);
          }
          return renderContact({ item });
        }}
        keyExtractor={(item) => item.type === 'header' ? item.id : item.id}
        style={styles.contactsList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#E5E7EB',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 16,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F1F1F',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  sectionTitle: {
    color: '#7B2CBF',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    color: '#9CA3AF',
    fontSize: 14,
    marginLeft: 8,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7B2CBF',
  },
  avatarText: {
    color: '#E5E7EB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  inviteText: {
    color: '#A855F7',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  registeredBadge: {
    padding: 4,
  },
  inviteButton: {
    backgroundColor: '#7B2CBF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#7B2CBF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default ContactsScreen;