import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import colors from '../theme/colors';
import { searchUsers } from '../lib/helpers/searchUsers';

interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onUserSelect: (user: User) => void;
}

const UserSearchModal: React.FC<Props> = ({ visible, onClose, onUserSelect }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const fetchUsers = async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setError(null);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const results = await searchUsers(q);
      
      // Validate results
      if (!Array.isArray(results)) {
        throw new Error('Invalid search results format');
      }
      
      setUsers(results);
    } catch (err) {
      console.error('Search error:', err);
      
      // Don't show error if request was aborted
      if (err.name !== 'AbortError') {
        const errorMessage = err.message || 'Failed to search users';
        setError(errorMessage);
        Toast.show({
          type: 'errorToast',
          text1: 'Search failed',
          text2: errorMessage,
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      fetchUsers(query);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Cleanup on unmount or modal close
  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setQuery('');
      setUsers([]);
      setError(null);
      setLoading(false);
      
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [visible]);

  const handleSelectUser = (user: User) => {
    try {
      // Validate user object
      if (!user || !user.id || !user.username) {
        throw new Error('Invalid user data');
      }

      // Call the parent's callback function
      onUserSelect(user);
      
      // Close modal and reset state
      handleClose();
      
    } catch (error) {
      console.error('Error selecting user:', error);
      Toast.show({
        type: 'errorToast',
        text1: 'Error selecting user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleClose = () => {
    setQuery('');
    setUsers([]);
    setError(null);
    setLoading(false);
    onClose();
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userRow} 
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      <Image
        source={
          item.avatar_url
            ? { uri: item.avatar_url }
            : require('../assets/images/avatar_placeholder.png')
        }
        style={styles.avatar}
        defaultSource={require('../assets/images/avatar_placeholder.png')}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.username || 'Unknown User'}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          {item.email || 'No email'}
        </Text>
      </View>
      <MaterialCommunityIcons 
        name="chevron-right" 
        size={20} 
        color={colors.textMuted || '#999'} 
      />
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) return null;
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="alert-circle-outline" 
            size={48} 
            color="#ff6b6b" 
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchUsers(query)}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (query.trim().length === 0) {
      return (
        <View style={styles.instructionContainer}>
          <MaterialCommunityIcons 
            name="account-search" 
            size={48} 
            color={colors.textMuted || '#999'} 
          />
          <Text style={styles.instructionText}>
            Enter a username or email to search for users
          </Text>
        </View>
      );
    }
    
    if (query.trim().length > 0 && users.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name="account-search-outline" 
            size={48} 
            color={colors.textMuted || '#999'} 
          />
          <Text style={styles.emptyText}>
            No users found for "{query}"
          </Text>
          <Text style={styles.emptySubtext}>
            Try a different search term
          </Text>
        </View>
      );
    }
    
    return null;
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Search Users</Text>
            <TouchableOpacity 
              onPress={handleClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name="close" 
                size={24} 
                color={colors.text || '#fff'} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons 
              name="magnify" 
              size={20} 
              color={colors.textMuted || '#999'} 
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username or email..."
              placeholderTextColor={colors.textMuted || '#999'}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {loading && (
              <ActivityIndicator 
                size="small" 
                color={colors.primary || '#bd93f9'} 
                style={styles.loadingIcon}
              />
            )}
          </View>

          <View style={styles.resultsContainer}>
            <FlatList
              data={users}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderUser}
              ListEmptyComponent={renderEmptyState}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.cardBackground || '#1e1e2e',
    borderRadius: 16,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
  },
  title: {
    color: colors.text || '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: colors.inputBackground || '#2a2a3d',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text || '#fff',
    paddingVertical: 12,
    fontSize: 16,
  },
  loadingIcon: {
    marginLeft: 8,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: colors.border || '#333',
    borderBottomWidth: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.border || '#555',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: colors.text || '#fff',
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textMuted || '#aaa',
  },
  instructionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  instructionText: {
    color: colors.textMuted || '#aaa',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textMuted || '#aaa',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted || '#aaa',
    textAlign: 'center',
    marginTop: 4,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: colors.primary || '#bd93f9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserSearchModal;