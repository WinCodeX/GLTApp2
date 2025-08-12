// lib/toastConfig.tsx - Styled to match app aesthetic
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const toastConfig = {
  defaultToast: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
        style={[styles.toast, styles.defaultToast]}
      >
        <MaterialCommunityIcons
          name="information"
          size={20}
          color="#7c3aed"
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={styles.toastText}>{text1}</Text>
          {text2 && <Text style={styles.toastSubText}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  successToast: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.15)']}
        style={[styles.toast, styles.successToast]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={22}
            color="#10b981"
            style={styles.icon}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.successText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.successSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  warningToast: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.15)', 'rgba(217, 119, 6, 0.15)']}
        style={[styles.toast, styles.warningToast]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="alert"
            size={22}
            color="#f59e0b"
            style={styles.icon}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.warningText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.warningSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  errorToast: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.15)', 'rgba(220, 38, 38, 0.15)']}
        style={[styles.toast, styles.errorToast]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={22}
            color="#ef4444"
            style={styles.icon}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.errorText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.errorSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),
};

const styles = StyleSheet.create({
  toastContainer: {
    paddingHorizontal: 20,
    marginTop: 50, // Account for status bar and notch
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    backdropFilter: 'blur(10px)',
  },
  
  defaultToast: {
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  
  successToast: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  
  warningToast: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  
  errorToast: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  
  icon: {
    marginRight: 12,
  },
  
  textContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  
  toastSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  
  // Success text styles
  successText: {
    color: '#10b981',
  },
  
  successSubText: {
    color: 'rgba(16, 185, 129, 0.8)',
  },
  
  // Warning text styles
  warningText: {
    color: '#f59e0b',
  },
  
  warningSubText: {
    color: 'rgba(245, 158, 11, 0.8)',
  },
  
  // Error text styles
  errorText: {
    color: '#ef4444',
  },
  
  errorSubText: {
    color: 'rgba(239, 68, 68, 0.8)',
  },
});