import React, { useState } from 'react';
import { Text } from 'react-native';
import AdminLayout from '../../components/AdminLayout';
import CreateLocation from './panels/CreateLocation';
import UserList from './panels/UserList';

export default function AdminScreen() {
  const [activePanel, setActivePanel] = useState('Dashboard');

  const renderPanel = () => {
    switch (activePanel) {
      case 'Create Location':
        return <CreateLocation />;
      case 'User List':
        return <UserList />;
      default:
        return <Text style={{ color: 'white' }}>Welcome to the Admin Dashboard</Text>;
    }
  };

  return (
    <AdminLayout onSelect={setActivePanel} activePanel={activePanel}>
      {renderPanel()}
    </AdminLayout>
  );
}