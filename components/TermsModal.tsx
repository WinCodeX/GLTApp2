// components/TermsModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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

    // Parse markdown-style content for basic formatting
    const formatContent = (content: string) => {
      const sections = content.split(/\n\s*\n/);
      
      return sections.map((section, index) => {
        if (section.trim().startsWith('**') && section.trim().endsWith('**')) {
          // Header
          const headerText = section.replace(/\*\*/g, '').trim();
          return (
            <Text key={index} style={styles.headerText}>
              {headerText}
            </Text>
          );
        } else if (section.trim().startsWith('*') && section.trim().endsWith('*')) {
          // Italic/footer
          const italicText = section.replace(/\*/g, '').trim();
          return (
            <Text key={index} style={styles.italicText}>
              {italicText}
            </Text>
          );
        } else {
          // Regular paragraph
          return (
            <Text key={index} style={styles.contentText}>
              {section.trim()}
            </Text>
          );
        }
      });
    };

    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {title || termsData.title}
        </Text>
        
        {termsData.summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>{termsData.summary}</Text>
          </View>
        )}
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version: {termsData.version}</Text>
          {termsData.effective_date && (
            <Text style={styles.versionText}>
              Effective: {new Date(termsData.effective_date).toLocaleDateString()}
            </Text>
          )}
        </View>
        
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
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
  },
  summaryText: {
    color: '#d1d5db',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  versionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  versionText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  contentContainer: {
    marginBottom: 32,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  contentText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  italicText: {
    color: '#9ca3af',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingBottom: 32,
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