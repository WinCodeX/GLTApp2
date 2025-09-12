// app/(admin)/TermsManagementScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import { colors } from '../../constants/colors';

interface Term {
  id: number;
  title: string;
  content?: string;
  version: string;
  term_type: string;
  active: boolean;
  summary?: string;
  effective_date?: string;
  created_at: string;
  updated_at: string;
}

interface CreateTermData {
  title: string;
  content: string;
  version: string;
  term_type: string;
  active: boolean;
  summary: string;
  effective_date: string;
}

const TERM_TYPES = [
  { key: 'terms_of_service', label: 'Terms of Service' },
  { key: 'privacy_policy', label: 'Privacy Policy' },
  { key: 'user_agreement', label: 'User Agreement' },
  { key: 'cookie_policy', label: 'Cookie Policy' },
];

export default function TermsManagementScreen() {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateTermData>({
    title: '',
    content: '',
    version: '',
    term_type: 'terms_of_service',
    active: false,
    summary: '',
    effective_date: '',
  });

  const [errors, setErrors] = useState<Partial<CreateTermData>>({});

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const response = await api.get('/api/v1/terms');
      if (response.data.success) {
        setTerms(response.data.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to fetch terms',
        });
      }
    } catch (error: any) {
      console.error('Fetch terms error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.error || 'Failed to fetch terms',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTerms();
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateTermData> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.content.trim()) newErrors.content = 'Content is required';
    if (!formData.version.trim()) newErrors.version = 'Version is required';
    if (!formData.term_type.trim()) newErrors.term_type = 'Term type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      version: '',
      term_type: 'terms_of_service',
      active: false,
      summary: '',
      effective_date: '',
    });
    setErrors({});
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setActionLoading(-1); // Use -1 for create action
      const payload = {
        term: {
          ...formData,
          effective_date: formData.effective_date || null,
        },
      };

      const response = await api.post('/api/v1/terms', payload);
      
      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Terms created successfully',
        });
        setShowCreateModal(false);
        resetForm();
        fetchTerms();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.data.errors?.join(', ') || 'Failed to create terms',
        });
      }
    } catch (error: any) {
      console.error('Create terms error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.errors?.join(', ') || 'Failed to create terms',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (term: Term) => {
    setEditingTerm(term);
    setFormData({
      title: term.title,
      content: term.content || '',
      version: term.version,
      term_type: term.term_type,
      active: term.active,
      summary: term.summary || '',
      effective_date: term.effective_date ? term.effective_date.split('T')[0] : '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!validateForm() || !editingTerm) return;

    try {
      setActionLoading(editingTerm.id);
      const payload = {
        term: {
          ...formData,
          effective_date: formData.effective_date || null,
        },
      };

      const response = await api.put(`/api/v1/terms/${editingTerm.id}`, payload);
      
      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Terms updated successfully',
        });
        setShowEditModal(false);
        setEditingTerm(null);
        resetForm();
        fetchTerms();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.data.errors?.join(', ') || 'Failed to update terms',
        });
      }
    } catch (error: any) {
      console.error('Update terms error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.errors?.join(', ') || 'Failed to update terms',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (term: Term) => {
    try {
      setActionLoading(term.id);
      const payload = {
        term: {
          active: !term.active,
        },
      };

      const response = await api.put(`/api/v1/terms/${term.id}`, payload);
      
      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Terms ${term.active ? 'deactivated' : 'activated'} successfully`,
        });
        fetchTerms();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.data.errors?.join(', ') || 'Failed to update terms',
        });
      }
    } catch (error: any) {
      console.error('Toggle active error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.errors?.join(', ') || 'Failed to update terms',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (term: Term) => {
    Alert.alert(
      'Delete Terms',
      `Are you sure you want to delete "${term.title}" (v${term.version})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(term),
        },
      ]
    );
  };

  const confirmDelete = async (term: Term) => {
    try {
      setActionLoading(term.id);
      // Note: Delete endpoint not shown in controller, assuming standard RESTful pattern
      const response = await api.delete(`/api/v1/terms/${term.id}`);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Terms deleted successfully',
      });
      fetchTerms();
    } catch (error: any) {
      console.error('Delete terms error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.error || 'Failed to delete terms',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const renderTermItem = (term: Term) => (
    <View key={term.id} style={styles.termCard}>
      <View style={styles.termHeader}>
        <View style={styles.termInfo}>
          <Text style={styles.termTitle}>{term.title}</Text>
          <View style={styles.termMeta}>
            <Text style={styles.termVersion}>v{term.version}</Text>
            <Text style={styles.termType}>
              {TERM_TYPES.find(type => type.key === term.term_type)?.label || term.term_type}
            </Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: term.active ? '#10b981' : '#64748b' }
            ]}>
              <Text style={styles.statusText}>
                {term.active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          {term.summary && (
            <Text style={styles.termSummary} numberOfLines={2}>
              {term.summary}
            </Text>
          )}
          <Text style={styles.termDate}>
            Created: {new Date(term.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.termActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(term)}
          disabled={actionLoading === term.id}
        >
          <Ionicons name="pencil" size={16} color="#3b82f6" />
          <Text style={[styles.actionText, { color: '#3b82f6' }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => handleToggleActive(term)}
          disabled={actionLoading === term.id}
        >
          <Ionicons 
            name={term.active ? "pause-circle" : "play-circle"} 
            size={16} 
            color={term.active ? "#f59e0b" : "#10b981"} 
          />
          <Text style={[styles.actionText, { color: term.active ? "#f59e0b" : "#10b981" }]}>
            {term.active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(term)}
          disabled={actionLoading === term.id}
        >
          <Ionicons name="trash" size={16} color="#ef4444" />
          <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormModal = (isEdit: boolean) => (
    <Modal
      visible={isEdit ? showEditModal : showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (isEdit) {
                  setShowEditModal(false);
                  setEditingTerm(null);
                } else {
                  setShowCreateModal(false);
                }
                resetForm();
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEdit ? 'Edit Terms' : 'Create New Terms'}
            </Text>
            <TouchableOpacity
              onPress={isEdit ? handleUpdate : handleCreate}
              disabled={actionLoading !== null}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {actionLoading !== null ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={[styles.textInput, errors.title && styles.inputError]}
                value={formData.title}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, title: text }));
                  if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
                }}
                placeholder="Enter terms title"
                placeholderTextColor="#666"
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Version */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Version *</Text>
              <TextInput
                style={[styles.textInput, errors.version && styles.inputError]}
                value={formData.version}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, version: text }));
                  if (errors.version) setErrors(prev => ({ ...prev, version: undefined }));
                }}
                placeholder="e.g., 1.0.0"
                placeholderTextColor="#666"
              />
              {errors.version && <Text style={styles.errorText}>{errors.version}</Text>}
            </View>

            {/* Term Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Term Type *</Text>
              <View style={styles.typeSelector}>
                {TERM_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeOption,
                      formData.term_type === type.key && styles.typeOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, term_type: type.key }))}
                  >
                    <Text style={[
                      styles.typeOptionText,
                      formData.term_type === type.key && styles.typeOptionTextSelected
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Summary */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Summary</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.summary}
                onChangeText={(text) => setFormData(prev => ({ ...prev, summary: text }))}
                placeholder="Brief summary of the terms"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Content */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.textInput, styles.contentArea, errors.content && styles.inputError]}
                value={formData.content}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, content: text }));
                  if (errors.content) setErrors(prev => ({ ...prev, content: undefined }));
                }}
                placeholder="Enter the full terms content (supports markdown formatting)"
                placeholderTextColor="#666"
                multiline
                numberOfLines={8}
              />
              {errors.content && <Text style={styles.errorText}>{errors.content}</Text>}
            </View>

            {/* Effective Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Effective Date</Text>
              <TextInput
                style={styles.textInput}
                value={formData.effective_date}
                onChangeText={(text) => setFormData(prev => ({ ...prev, effective_date: text }))}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor="#666"
              />
            </View>

            {/* Active Toggle */}
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
              >
                <View style={[styles.toggle, formData.active && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.active && styles.toggleThumbActive]} />
                </View>
                <Text style={styles.toggleLabel}>Make this version active</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <LinearGradient colors={['#0a0a0f', '#16213e']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Terms Management</Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={styles.addButton}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6c5ce7']}
              tintColor="#6c5ce7"
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading terms...</Text>
            </View>
          ) : terms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#64748b" />
              <Text style={styles.emptyTitle}>No Terms Created</Text>
              <Text style={styles.emptyText}>
                Create your first terms and conditions document
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Terms</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.termsList}>
              <Text style={styles.statsText}>
                {terms.length} terms • {terms.filter(t => t.active).length} active
              </Text>
              {terms.map(renderTermItem)}
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        {renderFormModal(false)}
        {renderFormModal(true)}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = {
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    backgroundColor: '#6c5ce7',
    borderRadius: 20,
    padding: 8,
  },

  // Content
  content: { flex: 1, paddingHorizontal: 20 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: { color: '#ccc', fontSize: 16 },
  
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Terms List
  termsList: { paddingVertical: 20 },
  statsText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Term Card
  termCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  termHeader: {
    marginBottom: 12,
  },
  termInfo: { flex: 1 },
  termTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  termMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  termVersion: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  termType: {
    color: '#ccc',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  termSummary: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  termDate: {
    color: '#64748b',
    fontSize: 12,
  },

  // Actions
  termActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  editButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  toggleButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  actionText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Form Inputs
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  contentArea: { height: 200, textAlignVertical: 'top' },
  inputError: { borderColor: '#ef4444' },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  typeOptionSelected: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  typeOptionText: {
    color: '#ccc',
    fontSize: 12,
  },
  typeOptionTextSelected: { color: '#fff' },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: '#6c5ce7' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  toggleLabel: { color: '#ccc', fontSize: 14 },
};