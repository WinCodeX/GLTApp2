import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const toastConfig = {
  defaultToast: ({ text1 }: any) => (
    <View style={[styles.toast, { backgroundColor: '#6272a4' }]}>
      <Text style={styles.toastText}>{text1}</Text>
    </View>
  ),

  successToast: ({ text1 }: any) => (
    <View style={[styles.toast, { backgroundColor: '#50fa7b' }]}>
      <Text style={styles.toastText}>{text1}</Text>
    </View>
  ),

  warningToast: ({ text1 }: any) => (
    <View style={[styles.toast, { backgroundColor: '#f1fa8c' }]}>
      <Text style={styles.toastText}>{text1}</Text>
    </View>
  ),

  errorToast: ({ text1 }: any) => (
    <View style={[styles.toast, styles.errorContainer]}>
      <MaterialCommunityIcons
        name="alert-circle"
        size={20}
        color="#fff"
        style={{ marginRight: 8 }}
      />
      <Text style={styles.errorText}>{text1}</Text>
    </View>
  ),
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignSelf: 'center',
    minWidth: '80%',
  },
  toastText: {
    color: '#1e1e2e',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ff5555',
  },
  errorText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
});