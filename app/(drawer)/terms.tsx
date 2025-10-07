// app/(drawer)/terms.tsx - Terms and Conditions Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GLTHeader from '../../components/GLTHeader';
import { NavigationHelper } from '../../lib/helpers/navigation';
import api from '../../lib/api';

interface TermsData {
  id: number;
  title: string;
  content: string;
  version: string;
  term_type: string;
  effective_date: string;
  summary?: string;
}

export default function TermsScreen() {
  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/v1/terms/current?type=terms_of_service');
      
      if (response.data.success) {
        setTermsData(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load terms');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to load terms';
      setError(errorMessage);
      console.error('Terms fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const handleRetry = () => {
    fetchTerms();
  };

  const formatContent = (content: string) => {
    // Split content into lines and process each one
    const lines = content.split('\n');
    let formattedSections: JSX.Element[] = [];
    let currentParagraph: string[] = [];
    let key = 0;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText) {
          formattedSections.push(
            <Text key={key++} style={styles.contentText}>
              {paragraphText}
            </Text>
          );
        }
        currentParagraph = [];
      }
    };

    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line - flush current paragraph
        flushParagraph();
        return;
      }

      // Check if it's a main section header (just numbers like "1. INTRODUCTION")
      if (/^\d+\.\s+[A-Z\s]+$/.test(trimmedLine)) {
        flushParagraph();
        formattedSections.push(
          <Text key={key++} style={styles.sectionHeader}>
            {trimmedLine}
          </Text>
        );
        return;
      }

      // Check if it's a subsection header (like "4.1 Payment Requirements")
      if (/^\d+\.\d+\s+/.test(trimmedLine)) {
        flushParagraph();
        formattedSections.push(
          <Text key={key++} style={styles.subSectionHeader}>
            {trimmedLine}
          </Text>
        );
        return;
      }

      // Check if it's a bullet point
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        flushParagraph();
        const bulletText = trimmedLine.substring(2);
        formattedSections.push(
          <View key={key++} style={styles.bulletContainer}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{bulletText}</Text>
          </View>
        );
        return;
      }

      // Regular content line - add to current paragraph
      currentParagraph.push(trimmedLine);
    });

    // Flush any remaining paragraph
    flushParagraph();

    return formattedSections;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#c084fc" />
          <Text style={styles.loadingText}>Loading terms and conditions...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="warning-outline" size={48} color="#f59e0b" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load Terms</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!termsData) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color="#a78bfa" />
          <Text style={styles.errorTitle}>No Terms Available</Text>
          <Text style={styles.errorText}>Terms and conditions are not available at this time</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{termsData.title}</Text>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#a78bfa" />
              <Text style={styles.metaText}>
                Effective: {new Date(termsData.effective_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="code-outline" size={14} color="#a78bfa" />
              <Text style={styles.metaText}>Version {termsData.version}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          {formatContent(termsData.content)}
        </View>
        
        <View style={styles.footerInfo}>
          <Ionicons name="information-circle-outline" size={20} color="#c084fc" />
          <Text style={styles.footerText}>
            Last updated on {new Date(termsData.effective_date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <GLTHeader 
        title="Terms and Conditions" 
        showBackButton={true}
        onBackPress={() => NavigationHelper.goBack()}
      />
      
      <LinearGradient 
        colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} 
        style={styles.gradient}
      >
        {renderContent()}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b3d',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  titleContainer: {
    marginTop: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 16,
    textAlign: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  metaText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '500',
  },
  contentContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
  },
  subSectionHeader: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  contentText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'justify',
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    marginLeft: 16,
    paddingRight: 8,
  },
  bullet: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    marginTop: 24,
  },
  footerText: {
    flex: 1,
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 18,
  },
});