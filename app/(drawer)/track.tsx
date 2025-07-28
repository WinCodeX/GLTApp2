// app/(drawer)/track.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Track() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>You can Track your package here!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: 'white', fontSize: 20 }
});