// app/(agent)/track.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';

interface TrackingEvent {
  id: number;
  event_type: string;
  event_type_display: string;
  description: string;
  created_at: string;
  timestamp: string;
  user: {
    name: string;
    role: string;
  };
}

interface PackageInfo {
  code: string;
  state: string;
  state_display: string;
  delivery_type_display: string;
  receiver: {
    name: string;
    phone: string;
  };
  route: {
    origin: string;
    destination: string;
    description: string;
  };
}

export default function TrackPackageScreen() {
  const router = useRouter();
  const [packageCode, setPackageCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);

  const handleTrack = async () => {
    if (!packageCode.trim()) {
      Alert.alert('Error', 'Please enter a package code');
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/api/v1/staff/packages/${packageCode.trim()}/track`);

      if (response.data.success) {
        setPackageInfo(response.data.data.package);
        setTrackingEvents(response.data.data.tracking_events || []);
      } else {
        Alert.alert('Error', response.data.message);
        setPackageInfo(null);
        setTrackingEvents([]);
      }
    } catch (error: any) {
      console.error('Track error:', error);
      Alert.alert(
        'Track Failed',
        error.response?.data?.message || 'Package not found'
      );
      setPackageInfo(null);
      setTrackingEvents([]);
    } finally {
      setSearching(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('print')) return 'printer';
    if (eventType.includes('collect')) return 'truck';
    if (eventType.includes('deliver')) return 'home';
    if (eventType.includes('process')) return 'package';
    return 'check-circle';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Package</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.searchSection}>
          <View style={styles.inputContainer}>
            <Feather name="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder="Enter package code"
              placeholderTextColor="#8E8E93"
              value={packageCode}
              onChangeText={setPackageCode}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleTrack}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, searching && styles.searchButtonDisabled]}
            onPress={handleTrack}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="search" size={20} color="#fff" />
                <Text style={styles.searchButtonText}>Track</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {packageInfo && (
          <>
            <View style={styles.packageSection}>
              <Text style={styles.sectionTitle}>Package Information</Text>
              <View style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageCode}>{packageInfo.code}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{packageInfo.state_display}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="user" size={16} color="#8E8E93" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Receiver</Text>
                    <Text style={styles.infoValue}>{packageInfo.receiver.name}</Text>
                    <Text style={styles.infoSubValue}>{packageInfo.receiver.phone}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="package" size={16} color="#8E8E93" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Delivery Type</Text>
                    <Text style={styles.infoValue}>
                      {packageInfo.delivery_type_display}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeSection}>
                  <View style={styles.routePoint}>
                    <View style={styles.routeDot} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>Origin</Text>
                      <Text style={styles.routeValue}>{packageInfo.route.origin}</Text>
                    </View>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, styles.routeDotDestination]} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>Destination</Text>
                      <Text style={styles.routeValue}>
                        {packageInfo.route.destination}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.trackingSection}>
              <Text style={styles.sectionTitle}>Tracking History</Text>
              {trackingEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="clock" size={48} color="#8E8E93" />
                  <Text style={styles.emptyStateText}>No tracking events yet</Text>
                </View>
              ) : (
                <View style={styles.timelineContainer}>
                  {trackingEvents.map((event, index) => (
                    <View key={event.id} style={styles.timelineItem}>
                      <View style={styles.timelineIconContainer}>
                        <View style={styles.timelineIcon}>
                          <Feather
                            name={getEventIcon(event.event_type) as any}
                            size={16}
                            color="#7B3F98"
                          />
                        </View>
                        {index < trackingEvents.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.eventTitle}>{event.description}</Text>
                        <Text style={styles.eventMeta}>
                          {event.user.name} • {formatTimestamp(event.timestamp)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {!packageInfo && !searching && (
          <View style={styles.placeholderContainer}>
            <Feather name="search" size={64} color="#8E8E93" />
            <Text style={styles.placeholderText}>
              Enter a package code to track
            </Text>
            <Text style={styles.placeholderSubtext}>
              View detailed tracking information and history
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  searchSection: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7B3F98',
    borderRadius: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  packageSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  packageCard: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  infoSubValue: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  routeSection: {
    marginTop: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7B3F98',
    marginTop: 4,
  },
  routeDotDestination: {
    backgroundColor: '#34C759',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: 'rgba(123, 63, 152, 0.3)',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  trackingSection: {
    padding: 16,
  },
  timelineContainer: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineIconContainer: {
    alignItems: 'center',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(123, 63, 152, 0.2)',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
});