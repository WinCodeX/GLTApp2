
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

const AdminSidebar = ({ visible, onClose, activePanel }) => {
  const [expandedSections, setExpandedSections] = useState({
    hangout: true,
    admin: true,
    logistics: true,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const adminFeatures = [
    { icon: 'cube-outline', title: 'Warehouse', id: 'warehouse' },
    { icon: 'search-outline', title: 'Search', id: 'search' },
    { icon: 'chatbubble-outline', title: 'Communicate', id: 'communicate' },
    { icon: 'grid-outline', title: 'Switchboard', id: 'switchboard' },
    { icon: 'people-outline', title: 'Users', id: 'users' },
    { icon: 'lock-open-outline', title: 'Unlocking', id: 'unlocking' },
    { icon: 'card-outline', title: 'Withdrawals', id: 'withdrawals' },
    { icon: 'pricetag-outline', title: 'Pricing', id: 'pricing' },
  ];

  const supportFeatures = [
    { icon: 'help-circle-outline', title: 'Support', id: 'support' },
    { icon: 'ticket-outline', title: 'Tickets', id: 'tickets' },
    { icon: 'business-outline', title: 'Business', id: 'business' },
    { icon: 'chatbubble-ellipses-outline', title: 'Feedback', id: 'feedback' },
    { icon: 'diamond-outline', title: 'Enterprise', id: 'enterprise' },
    { icon: 'document-text-outline', title: 'Terms', id: 'terms' },
    { icon: 'phone-portrait-outline', title: 'App Manager', id: 'app-manager' },
  ];

  const logisticsFeatures = [
    { icon: 'location-outline', title: 'Track Package', id: 'track' },
    { icon: 'car-outline', title: 'Currently Reaching', id: 'reaching' },
    { icon: 'calculator-outline', title: 'Cost Calculator', id: 'calculator' },
    { icon: 'time-outline', title: 'History', id: 'history' },
    { icon: 'contacts-outline', title: 'Contacts', id: 'contacts' },
  ];

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        zIndex: 999,
      }}
    >
      <LinearGradient
        colors={['#2d3748', '#1a202c', '#16213e']}
        style={{
          flex: 1,
          paddingTop: Platform.OS === 'ios' ? 0 : 0,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#4a5568' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#6c5ce7',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                    GL
                  </Text>
                </View>
                <View>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                    GLT Logistics
                  </Text>
                  <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                    Admin Panel
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#a0aec0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* User Profile Section */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#4a5568' }}>
            <LinearGradient
              colors={['#6c5ce7', '#a29bfe']}
              style={{
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="person" size={24} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                  Admin User
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  +254 712 299 377
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="white" />
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#a0aec0', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' }}>
              Quick Actions
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2d3748',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#4a5568',
                }}
              >
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>Thika</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2d3748',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#4a5568',
                }}
              >
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>Machakos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2d3748',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#4a5568',
                }}
              >
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>Kisii</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logistics Features */}
          <View style={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => toggleSection('logistics')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={expandedSections.logistics ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color="#a0aec0"
              />
              <Text style={{ color: '#a0aec0', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                Logistics
              </Text>
            </TouchableOpacity>
            {expandedSections.logistics && (
              <View style={{ marginLeft: 24, marginBottom: 16 }}>
                {logisticsFeatures.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: activePanel === item.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={activePanel === item.id ? '#6c5ce7' : '#a0aec0'}
                    />
                    <Text
                      style={{
                        color: activePanel === item.id ? '#6c5ce7' : '#cbd5e0',
                        fontSize: 14,
                        marginLeft: 12,
                        fontWeight: activePanel === item.id ? '600' : '400',
                      }}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </div>

          {/* Admin Features */}
          <View style={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => toggleSection('admin')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={expandedSections.admin ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color="#a0aec0"
              />
              <Text style={{ color: '#a0aec0', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                Admin Features
              </Text>
            </TouchableOpacity>
            {expandedSections.admin && (
              <View style={{ marginLeft: 24, marginBottom: 16 }}>
                {adminFeatures.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: activePanel === item.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={activePanel === item.id ? '#6c5ce7' : '#a0aec0'}
                    />
                    <Text
                      style={{
                        color: activePanel === item.id ? '#6c5ce7' : '#cbd5e0',
                        fontSize: 14,
                        marginLeft: 12,
                        fontWeight: activePanel === item.id ? '600' : '400',
                      }}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Support & More */}
          <View style={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => toggleSection('hangout')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={expandedSections.hangout ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color="#a0aec0"
              />
              <Text style={{ color: '#a0aec0', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                Support & More
              </Text>
            </TouchableOpacity>
            {expandedSections.hangout && (
              <View style={{ marginLeft: 24, marginBottom: 16 }}>
                {supportFeatures.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: activePanel === item.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={activePanel === item.id ? '#6c5ce7' : '#a0aec0'}
                    />
                    <Text
                      style={{
                        color: activePanel === item.id ? '#6c5ce7' : '#cbd5e0',
                        fontSize: 14,
                        marginLeft: 12,
                        fontWeight: activePanel === item.id ? '600' : '400',
                      }}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

export default AdminSidebar;