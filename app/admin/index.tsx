import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef } from 'react';
import {
  Dimensions,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  PanGestureHandler,
  Animated,
} from 'react-native';
import AdminLayout from '../../components/AdminLayout';

const { width } = Dimensions.get('window');

const AdminIndex = () => {
  const [activePerformanceTab, setActivePerformanceTab] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const panRef = useRef();

  const performanceData = {
    weekly: {
      title: 'Weekly Performance',
      data: [65, 45, 80, 55, 75, 90, 70],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      growth: '+23%',
      total: '1,847',
      successRate: '94.2%',
      period: 'vs last week'
    },
    monthly: {
      title: 'Monthly Performance',
      data: [75, 85, 65, 90, 80, 95, 70, 85, 75, 80, 90, 85],
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      growth: '+45%',
      total: '12,450',
      successRate: '96.1%',
      period: 'vs last month'
    },
    yearly: {
      title: 'Yearly Performance',
      data: [60, 70, 85, 90, 95],
      labels: ['2020', '2021', '2022', '2023', '2024'],
      growth: '+127%',
      total: '156,789',
      successRate: '97.8%',
      period: 'vs last year'
    }
  };

  const performanceTabs = ['weekly', 'monthly', 'yearly'];

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

  const handleTabPress = (index) => {
    setActivePerformanceTab(index);
    Animated.spring(translateX, {
      toValue: -index * (width - 32),
      useNativeDriver: true,
    }).start();
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === 5) { // End state
      const { translationX } = event.nativeEvent;
      let newIndex = activePerformanceTab;

      if (translationX > 50 && activePerformanceTab > 0) {
        newIndex = activePerformanceTab - 1;
      } else if (translationX < -50 && activePerformanceTab < 2) {
        newIndex = activePerformanceTab + 1;
      }

      handleTabPress(newIndex);
    }
  };

  const currentPerformance = performanceData[performanceTabs[activePerformanceTab]];

  return (
    <AdminLayout activePanel="home">
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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

          {/* Performance Overview Section */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Performance Overview
            </Text>
            
            {/* Tab Indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
              {performanceTabs.map((tab, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleTabPress(index)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    marginHorizontal: 4,
                    borderRadius: 20,
                    backgroundColor: activePerformanceTab === index ? '#6c5ce7' : 'rgba(108, 92, 231, 0.1)',
                    borderWidth: 1,
                    borderColor: activePerformanceTab === index ? '#6c5ce7' : 'rgba(108, 92, 231, 0.3)',
                  }}
                >
                  <Text style={{
                    color: activePerformanceTab === index ? 'white' : '#6c5ce7',
                    fontSize: 12,
                    fontWeight: '600',
                    textTransform: 'capitalize'
                  }}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Performance Charts Container */}
            <View style={{ overflow: 'hidden', borderRadius: 12 }}>
              <PanGestureHandler
                ref={panRef}
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
              >
                <Animated.View
                  style={{
                    flexDirection: 'row',
                    transform: [{ translateX }],
                  }}
                >
                  {performanceTabs.map((tab, tabIndex) => {
                    const data = performanceData[tab];
                    return (
                      <LinearGradient
                        key={tabIndex}
                        colors={['#2d3748', '#1a202c']}
                        style={{
                          width: width - 32,
                          borderRadius: 12,
                          padding: 20,
                          borderWidth: 1,
                          borderColor: '#4a5568',
                          marginRight: tabIndex < performanceTabs.length - 1 ? 0 : 0,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                            {data.title}
                          </Text>
                          <TouchableOpacity>
                            <Text style={{ color: '#6c5ce7', fontSize: 12, fontWeight: '600' }}>
                              View Details
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Chart */}
                        <View style={{ flexDirection: 'row', alignItems: 'end', justifyContent: 'space-between', height: 100, marginBottom: 16 }}>
                          {data.data.map((height, index) => (
                            <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                              <LinearGradient
                                colors={['#6c5ce7', '#a29bfe']}
                                style={{
                                  width: tab === 'yearly' ? 25 : tab === 'monthly' ? 15 : 20,
                                  height: height,
                                  borderRadius: 4,
                                  marginBottom: 8,
                                }}
                              />
                              <Text style={{ color: '#a0aec0', fontSize: tab === 'monthly' ? 8 : 10 }}>
                                {data.labels[index]}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: '#00b894', fontSize: 14, fontWeight: 'bold' }}>
                              {data.growth}
                            </Text>
                            <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                              {data.period}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                              {data.total}
                            </Text>
                            <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                              Total deliveries
                            </Text>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: '#6c5ce7', fontSize: 14, fontWeight: 'bold' }}>
                              {data.successRate}
                            </Text>
                            <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                              Success rate
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    );
                  })}
                </Animated.View>
              </PanGestureHandler>
            </View>
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
        </View>
      </ScrollView>
    </AdminLayout>
  );
};

export default AdminIndex;