// lib/toastConfig.tsx - Styled to match app aesthetic
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.15)']}
        style={[styles.toast, styles.successToast]}
      >
        <View style={[styles.iconContainer, styles.successIconContainer]}>
          <MaterialCommunityIcons
            name="check-circle"
            size={22}
            color="#10b981"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.successText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.successSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  error: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.15)', 'rgba(220, 38, 38, 0.15)']}
        style={[styles.toast, styles.errorToast]}
      >
        <View style={[styles.iconContainer, styles.errorIconContainer]}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={22}
            color="#ef4444"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.errorText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.errorSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  warning: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.15)', 'rgba(217, 119, 6, 0.15)']}
        style={[styles.toast, styles.warningToast]}
      >
        <View style={[styles.iconContainer, styles.warningIconContainer]}>
          <MaterialCommunityIcons
            name="alert"
            size={22}
            color="#f59e0b"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.warningText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.warningSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),

  info: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.15)', 'rgba(99, 102, 241, 0.15)']}
        style={[styles.toast, styles.infoToast]}
      >
        <View style={[styles.iconContainer, styles.infoIconContainer]}>
          <MaterialCommunityIcons
            name="information"
            size={22}
            color="#7c3aed"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toastText, styles.infoText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, styles.infoSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </View>
  ),
};

const styles = StyleSheet.create({
  toastContainer: {
    paddingHorizontal: 16, // Reduced padding for more width
    marginTop: 60, // Account for status bar and notch
    marginHorizontal: 0, // Full width
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, // Increased padding for better text spacing
    paddingVertical: 18, // Increased vertical padding
    borderRadius: 16, // Slightly smaller radius for more rectangular shape
    borderWidth: 1.5, // Slightly thicker border
    backgroundColor: 'rgba(26, 26, 46, 0.98)', // More opaque background
    backdropFilter: 'blur(15px)',
    overflow: 'hidden',
    minHeight: 64, // Minimum height for consistent sizing
    width: '100%', // Full width of container
  },
  
  successToast: {
    borderColor: 'rgba(16, 185, 129, 0.6)', // More visible border
    backgroundColor: 'rgba(26, 46, 37, 0.98)', // More opaque background
  },
  
  errorToast: {
    borderColor: 'rgba(239, 68, 68, 0.6)', // More visible border
    backgroundColor: 'rgba(46, 26, 26, 0.98)', // More opaque background
  },
  
  warningToast: {
    borderColor: 'rgba(245, 158, 11, 0.6)', // More visible border
    backgroundColor: 'rgba(46, 39, 26, 0.98)', // More opaque background
  },
  
  infoToast: {
    borderColor: 'rgba(124, 58, 237, 0.6)', // More visible border
    backgroundColor: 'rgba(35, 26, 46, 0.98)', // More opaque background
  },
  
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  
  successIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  
  errorIconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  
  warningIconContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  
  infoIconContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  
  textContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center', // Center text vertically
  },
  
  toastText: {
    color: '#fff',
    fontSize: 17, // Slightly larger font
    fontWeight: '700',
    lineHeight: 24, // Better line spacing
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)', // Text shadow for better visibility
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  toastSubText: {
    color: 'rgba(255, 255, 255, 0.9)', // More opaque subtitle
    fontSize: 15, // Slightly larger subtitle
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 20, // Better line spacing
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // Subtle shadow for subtitle
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  
  // Success text styles
  successText: {
    color: '#22c55e', // Brighter green
    textShadowColor: 'rgba(34, 197, 94, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  successSubText: {
    color: 'rgba(34, 197, 94, 0.95)', // More opaque
  },
  
  // Error text styles
  errorText: {
    color: '#f87171', // Brighter red
    textShadowColor: 'rgba(248, 113, 113, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  errorSubText: {
    color: 'rgba(248, 113, 113, 0.95)', // More opaque
  },
  
  // Warning text styles
  warningText: {
    color: '#fbbf24', // Brighter yellow
    textShadowColor: 'rgba(251, 191, 36, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  warningSubText: {
    color: 'rgba(251, 191, 36, 0.95)', // More opaque
  },
  
  // Info text styles
  infoText: {
    color: '#a78bfa', // Brighter purple
    textShadowColor: 'rgba(167, 139, 250, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  infoSubText: {
    color: 'rgba(167, 139, 250, 0.95)', // More opaque
  },
});