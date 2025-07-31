
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AdminLayout from '../components/AdminLayout';

const { width } = Dimensions.get('window');

const AdminIndex = () => {
  const dashboardStats = [
    {
      title: 'Active Packages',
      value: '1,234',
      icon: 'cube',
      color: ['#6c5ce7', '#a29bfe'],
      change: '+12%',
    },
    {
      title: 'Total Revenue',
      value: '₹45,678',
      icon: 'card',
      color: ['#00b894', '#00cec9'],
      change: '+8%',
    },
    {
      title: 'Active Users',
      value: '892',
      icon: 'people',
      color: ['#fd79a8', '#fdcb6e'],
      change: '+15%',
    },
    {
      title: 'Support Tickets',
      value: '23',
      icon: 'help-circle',
      color: ['#e17055', '#fab1a0'],
      change: '-5%',
    },
  ];

  const quickActions = [
    { 
      title: 'Track Package', 
      icon: 'location', 
      description: 'Track packages in real-time',
      colors: ['#6c5ce7', '#a29bfe'] 
    },
    { 
      title: 'Cost Calculator', 
      icon: 'calculator', 
      description: 'Calculate shipping costs',
      colors: ['#00b894', '#00cec9'] 
    },
    { 
      title: 'User Management', 
      icon: 'people', 
      description: 'Manage user accounts',
      colors: ['#fd79a8', '#fdcb6e'] 
    },
    { 
      title: 'Support Center', 
      icon: 'help-circle', 
      description: 'Handle customer support',
      colors: ['#e17055', '#fab1a0'] 
    },
    { 
      title: 'Warehouse', 
      icon: 'cube', 
      description: 'Manage inventory',
      colors: ['#74b9ff', '#0984e3'] 
    },
    { 
      title: 'Reports', 
      icon: 'bar-chart', 
      description: 'View analytics & reports',
      colors: ['#a29bfe', '#6c5ce7'] 
    },
  ];

  const recentActivities = [
    { id: 1, title: 'New package added', time: '2 min ago', icon: 'add-circle', color: '#00b894' },
    { id: 2, title: 'User registered', time: '5 min ago', icon: 'person-add', color: '#6c5ce7' },
    { id: 3, title: 'Payment received', time: '10 min ago', icon: 'card', color: '#00cec9' },
    { id: 4, title: 'Package delivered', time: '15 min ago', icon: 'checkmark-circle', color: '#fd79a8' },
    { id: 5, title: 'Support ticket closed', time: '20 min ago', icon: 'close-circle', color: '#e17055' },
  ];

  const pendingTasks = [
    { id: 1, title: 'Review pending withdrawals', priority: 'high', count: 5 },
    { id: 2, title: 'Process new user verifications', priority: 'medium', count: 12 },
    { id: 3, title: 'Update warehouse inventory', priority: 'low', count: 3 },
    { id: 4, title: 'Respond to support tickets', priority: 'high', count: 8 },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#e17055';
      case 'medium': return '#fdcb6e';
      case 'low': return '#00b894';
      default: return '#a0aec0';
    }
  };

  return (
    <AdminLayout activePanel="home">
      <View style={{ padding: 16 }}>
        {/* Welcome Section */}
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
            Welcome back, Admin! 👋
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 16 }}>
            Here's what's happening with GLT Logistics today
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>View Analytics</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats Cards */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Overview
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {dashboardStats.map((stat, index) => (
              <View
                key={index}
                style={{
                  width: (width - 48) / 2,
                  marginBottom: 16,
                }}
              >
                <LinearGradient
                  colors={stat.color}
                  style={{
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Ionicons name={stat.icon} size={24} color="white" />
                    <Text style={{ color: stat.change.startsWith('+') ? '#00b894' : '#e17055', fontSize: 12, fontWeight: '600' }}>
                      {stat.change}
                    </Text>
                  </View>
                  <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
                    {stat.value}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    {stat.title}
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  width: (width - 48) / 2,
                  marginBottom: 12,
                }}
              >
                <LinearGradient
                  colors={['#2d3748', '#1a202c']}
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#4a5568',
                  }}
                >
                  <LinearGradient
                    colors={action.colors}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name={action.icon} size={20} color="white" />
                  </LinearGradient>
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                    {action.title}
                  </Text>
                  <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                    {action.description}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activities & Pending Tasks Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          {/* Recent Activities */}
          <View style={{ width: (width - 48) / 2, marginRight: 8 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Recent Activities
            </Text>
            <View
              style={{
                backgroundColor: '#2d3748',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#4a5568',
              }}
            >
              {recentActivities.slice(0, 4).map((activity) => (
                <View
                  key={activity.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: activity.id !== 4 ? 1 : 0,
                    borderBottomColor: '#4a5568',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: activity.color + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={activity.icon} size={16} color={activity.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '500' }}>
                      {activity.title}
                    </Text>
                    <Text style={{ color: '#a0aec0', fontSize: 10 }}>
                      {activity.time}
                    </Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={{ marginTop: 12 }}>
                <Text style={{ color: '#6c5ce7', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                  View All Activities
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pending Tasks */}
          <View style={{ width: (width - 48) / 2, marginLeft: 8 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Pending Tasks
            </Text>
            <View
              style={{
                backgroundColor: '#2d3748',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#4a5568',
              }}
            >
              {pendingTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: task.id !== pendingTasks.length ? 1 : 0,
                    borderBottomColor: '#4a5568',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '500', marginBottom: 2 }}>
                      {task.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: getPriorityColor(task.priority),
                          marginRight: 6,
                        }}
                      />
                      <Text style={{ color: '#a0aec0', fontSize: 10, textTransform: 'capitalize' }}>
                        {task.priority} Priority
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: getPriorityColor(task.priority) + '20',
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: getPriorityColor(task.priority),
                        fontSize: 10,
                        fontWeight: '600',
                      }}
                    >
                      {task.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ marginTop: 12 }}>
                <Text style={{ color: '#6c5ce7', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                  View All Tasks
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Performance Chart Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Performance Overview
          </Text>
          <LinearGradient
            colors={['#2d3748', '#1a202c']}
            style={{
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: '#4a5568',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                Weekly Performance
              </Text>
              <TouchableOpacity>
                <Text style={{ color: '#6c5ce7', fontSize: 12, fontWeight: '600' }}>
                  View Details
                </Text>
              </TouchableOpacity>
            </View>

            {/* Simple Chart Representation */}
            <View style={{ flexDirection: 'row', alignItems: 'end', justifyContent: 'space-between', height: 100, marginBottom: 16 }}>
              {[65, 45, 80, 55, 75, 90, 70].map((height, index) => (
                <View key={index} style={{ alignItems: 'center' }}>
                  <LinearGradient
                    colors={['#6c5ce7', '#a29bfe']}
                    style={{
                      width: 20,
                      height: height,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  />
                  <Text style={{ color: '#a0aec0', fontSize: 10 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#00b894', fontSize: 14, fontWeight: 'bold' }}>
                  +23%
                </Text>
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                  vs last week
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                  1,847
                </Text>
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                  Total deliveries
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#6c5ce7', fontSize: 14, fontWeight: 'bold' }}>
                  94.2%
                </Text>
                <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                  Success rate
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Stats Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <LinearGradient
            colors={['#fd79a8', '#fdcb6e']}
            style={{
              width: (width - 48) / 3 - 8,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Ionicons name="trending-up" size={24} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
              127%
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textAlign: 'center' }}>
              Growth Rate
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={['#00b894', '#00cec9']}
            style={{
              width: (width - 48) / 3 - 8,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Ionicons name="time" size={24} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
              2.3h
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textAlign: 'center' }}>
              Avg Delivery
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={['#74b9ff', '#0984e3']}
            style={{
              width: (width - 48) / 3 - 8,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Ionicons name="star" size={24} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
              4.8
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textAlign: 'center' }}>
              Customer Rating
            </Text>
          </LinearGradient>
        </View>
      </View>
    </AdminLayout>
  );
};

export default AdminIndex;