// app/(drawer)/faqs.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Faqs() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to GLT's FAQs!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: 'white', fontSize: 20 }
});