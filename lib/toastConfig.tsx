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
    paddingHorizontal: 20,
    marginTop: 50, // Account for status bar and notch
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
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    backdropFilter: 'blur(15px)',
    overflow: 'hidden',
  },
  
  successToast: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(26, 46, 37, 0.95)',
  },
  
  errorToast: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(46, 26, 26, 0.95)',
  },
  
  warningToast: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(46, 39, 26, 0.95)',
  },
  
  infoToast: {
    borderColor: 'rgba(124, 58, 237, 0.4)',
    backgroundColor: 'rgba(35, 26, 46, 0.95)',
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
  },
  
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  
  toastSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  
  // Success text styles
  successText: {
    color: '#10b981',
    textShadowColor: 'rgba(16, 185, 129, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  successSubText: {
    color: 'rgba(16, 185, 129, 0.9)',
  },
  
  // Error text styles
  errorText: {
    color: '#ef4444',
    textShadowColor: 'rgba(239, 68, 68, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  errorSubText: {
    color: 'rgba(239, 68, 68, 0.9)',
  },
  
  // Warning text styles
  warningText: {
    color: '#f59e0b',
    textShadowColor: 'rgba(245, 158, 11, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  warningSubText: {
    color: 'rgba(245, 158, 11, 0.9)',
  },
  
  // Info text styles
  infoText: {
    color: '#7c3aed',
    textShadowColor: 'rgba(124, 58, 237, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  infoSubText: {
    color: 'rgba(124, 58, 237, 0.9)',
  },
});