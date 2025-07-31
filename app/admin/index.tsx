// app/admin/index.tsx
import React, { useState } from 'react';
import { Text } from 'react-native';
import AdminLayout from '../../components/AdminLayout';
import CreateLocation from './panels/CreateLocation';
import UserList from './panels/UserList';
// etc...

export default function AdminScreen() {
  const [activePanel, setActivePanel] = useState('Create Location');

  const renderPanel = () => {
    switch (activePanel) {
      case 'Create Location':
        return <CreateLocation />;
      case 'User List':
        return <UserList />;
      default:
        return <Text style={{ color: 'white' }}>Select a panel from the sidebar</Text>;
    }
  };

  return <AdminLayout onSelect={setActivePanel}>{renderPanel()}</AdminLayout>;
}