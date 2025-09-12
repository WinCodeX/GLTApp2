// components/TermsModal.tsx - Simplified version with cleaner display
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

interface TermsData {
  id: number;
  title: string;
  content: string;
  version: string;
  term_type: string;
  effective_date: string;
  summary?: string;
}

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  termType?: 'terms_of_service' | 'privacy_policy';
  title?: string;
}

export default function TermsModal({
  visible,
  onClose,
  onAccept,
  showAcceptButton = false,
  termType = 'terms_of_service',
  title,
}: TermsModalProps) {
  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/v1/terms/current?type=${termType}`);
      
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
    if (visible && !termsData) {
      fetchTerms();
    }
  }, [visible, termType]);

  const handleAccept = () => {
    onAccept?.();
    onClose();
  };

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
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading terms...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="warning-outline" size={48} color="#f59e0b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!termsData) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No terms available</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {title || termsData.title}
        </Text>
        
        <View style={styles.contentContainer}>
          {formatContent(termsData.content)}
        </View>
        
        {showAcceptButton && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
              <Text style={styles.acceptButtonText}>I Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {title || (termType === 'privacy_policy' ? 'Privacy Policy' : 'Terms of Service')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.content}>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2d2d44',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  contentContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
  },
  subSectionHeader: {
    color: '#fff',
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
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    marginLeft: 16,
  },
  bullet: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 32,
    paddingTop: 16,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});