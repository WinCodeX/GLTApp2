// app/(agent)/calls.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { AgentBottomTabs } from '../../components/agent/AgentBottomTabs';

export default function AgentCallsScreen() {
  const calls = [
    {
      id: 1,
      name: 'Customer Support',
      type: 'incoming',
      time: 'Today, 10:30 AM',
      duration: '5:23',
      status: 'answered',
    },
    {
      id: 2,
      name: 'Warehouse Manager',
      type: 'outgoing',
      time: 'Yesterday, 3:45 PM',
      duration: '2:10',
      status: 'answered',
    },
    {
      id: 3,
      name: 'Dispatch Team',
      type: 'incoming',
      time: 'Yesterday, 11:20 AM',
      duration: '0:00',
      status: 'missed',
    },
  ];

  const getCallIcon = (type: string) => {
    return type === 'incoming' ? 'phone-incoming' : 'phone-outgoing';
  };

  const getCallColor = (status: string) => {
    return status === 'missed' ? '#FF3B30' : '#7B3F98';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Calls</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="phone" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {calls.map((call) => (
          <TouchableOpacity key={call.id} style={styles.callItem}>
            <View style={[
              styles.callIconContainer,
              { backgroundColor: `${getCallColor(call.status)}20` }
            ]}>
              <Feather
                name={getCallIcon(call.type) as any}
                size={20}
                color={getCallColor(call.status)}
              />
            </View>
            <View style={styles.callContent}>
              <Text style={styles.callName}>{call.name}</Text>
              <View style={styles.callInfo}>
                <Text style={[
                  styles.callTime,
                  call.status === 'missed' && styles.missedCall
                ]}>
                  {call.time}
                </Text>
                {call.duration !== '0:00' && (
                  <>
                    <Text style={styles.callDot}> • </Text>
                    <Text style={styles.callDuration}>{call.duration}</Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Feather name="phone" size={20} color="#7B3F98" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AgentBottomTabs currentTab="calls" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  callIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callContent: {
    flex: 1,
  },
  callName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTime: {
    color: '#8E8E93',
    fontSize: 14,
  },
  callDot: {
    color: '#8E8E93',
    fontSize: 14,
  },
  callDuration: {
    color: '#8E8E93',
    fontSize: 14,
  },
  missedCall: {
    color: '#FF3B30',
  },
  callButton: {
    padding: 8,
  },
});