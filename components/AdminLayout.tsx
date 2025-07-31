
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AdminSidebar from './AdminSidebar';

const { width, height } = Dimensions.get('window');

const AdminLayout = ({ children, activePanel = 'home' }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const bottomTabs = [
    { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
    { id: 'scan', icon: 'qr-code-outline', activeIcon: 'qr-code', label: 'Scan' },
    { id: 'packages', icon: 'cube-outline', activeIcon: 'cube', label: 'Packages' },
    { id: 'settings', icon: 'settings-outline', activeIcon: 'settings', label: 'Settings' },
    { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'You' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />
      
      {/* Fixed Header */}
      <SafeAreaView>
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left side - Menu & Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setSidebarVisible(!sidebarVisible)}
              style={{
                padding: 8,
                marginRight: 12,
              }}
            >
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#2d3748',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  GL
                </Text>
              </View>
              <View>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                  GLT Logistics
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  Admin Panel
                </Text>
              </View>
            </View>
          </View>

          {/* Center - Search Bar */}
          <View
            style={{
              flex: 1,
              maxWidth: 300,
              marginHorizontal: 16,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              height: 36,
            }}
          >
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
            <TextInput
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.8)"
              style={{
                flex: 1,
                marginLeft: 8,
                color: 'white',
                fontSize: 14,
              }}
            />
          </View>

          {/* Right side - Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={{ padding: 8, marginRight: 8 }}>
              <Ionicons name="notifications-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#2d3748',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={16} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Main Content Area */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Sidebar */}
        <AdminSidebar 
          visible={sidebarVisible} 
          onClose={() => setSidebarVisible(false)}
          activePanel={activePanel}
        />

        {/* Content Area */}
        <View style={{ flex: 1, backgroundColor: '#0f0f23' }}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f0f23']}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {children}
            </ScrollView>
          </LinearGradient>
        </View>

        {/* Overlay for mobile sidebar */}
        {sidebarVisible && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 998,
            }}
            onPress={() => setSidebarVisible(false)}
          />
        )}
      </View>

      {/* Bottom Tab Bar - Mobile */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#16213e',
          borderTopWidth: 1,
          borderTopColor: '#2d3748',
          paddingVertical: 8,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {bottomTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={{
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 8,
            }}
          >
            <Ionicons
              name={activeTab === tab.id ? tab.activeIcon : tab.icon}
              size={22}
              color={activeTab === tab.id ? '#6c5ce7' : '#a0aec0'}
            />
            <Text
              style={{
                fontSize: 10,
                marginTop: 2,
                color: activeTab === tab.id ? '#6c5ce7' : '#a0aec0',
                fontWeight: activeTab === tab.id ? '600' : '400',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 8,
          shadowColor: '#6c5ce7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }}
      >
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe']}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default AdminLayout;