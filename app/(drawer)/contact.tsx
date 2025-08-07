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
              <Ionicons name="checkmark-circle" size={20} color="#25D366" />
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

  const renderHeader = () => (
    <View style={styles.headerOptions}>
      <TouchableOpacity style={styles.headerOption}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="people" size={24} color="#25D366" />
        </View>
        <Text style={styles.headerOptionText}>New group</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.headerOption}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="person-add" size={24} color="#25D366" />
        </View>
        <Text style={styles.headerOptionText}>New contact</Text>
        <View style={styles.qrCode}>
          <Ionicons name="qr-code" size={16} color="#666" />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.headerOption}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="people-circle" size={24} color="#25D366" />
        </View>
        <Text style={styles.headerOptionText}>New community</Text>
      </TouchableOpacity>
      
      <Text style={styles.sectionTitle}>Contacts on GLT</Text>
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
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        style={styles.contactsList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  headerOptions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerOptionText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  qrCode: {
    marginLeft: 'auto',
  },
  sectionTitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
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
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  inviteText: {
    color: '#25D366',
    fontSize: 12,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  registeredBadge: {
    padding: 4,
  },
  inviteButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ContactsScreen;