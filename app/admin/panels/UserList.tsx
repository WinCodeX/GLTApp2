// app/admin/panels/UserList.tsx
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import api from '../../../lib/api';

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const response = await api.get('/api/v1/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const renderItem = ({ item }: any) => (
    <View style={styles.item}>
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.role}>Roles: {item.roles.join(', ')}</Text>
    </View>
  );

  if (loading) return <ActivityIndicator size="large" color="#bd93f9" />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (users.length === 0) return <Text style={styles.empty}>No users found.</Text>;

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 10,
  },
  item: {
    backgroundColor: '#1e1e2f',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  email: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  role: {
    color: '#bd93f9',
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    marginTop: 16,
  },
  empty: {
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});