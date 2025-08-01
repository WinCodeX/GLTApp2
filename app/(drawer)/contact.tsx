// app/(drawer)/contact.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Contact() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to GLT Contacts!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: 'white', fontSize: 20 }
});