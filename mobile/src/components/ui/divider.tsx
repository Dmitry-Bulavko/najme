import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export function Divider({ label }: { label?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {label && <Text style={styles.label}>{label}</Text>}
      {label && <View style={styles.line} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: Colors.base04 },
  label: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.text03,
  },
});
