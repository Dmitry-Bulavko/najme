import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/colors';

const POPULAR = [
  { icon: 'sparkles-outline', label: 'Cleaning' },
  { icon: 'hammer-outline', label: 'Repair' },
  { icon: 'people-outline', label: 'Babysitting' },
  { icon: 'fitness-outline', label: 'Massage' },
  { icon: 'laptop-outline', label: 'Technical' },
  { icon: 'construct-outline', label: 'Other' },
];

const CITIES = ['Podgorica', 'Budva', 'Kotor', 'Bar', 'Herceg Novi', 'Nikšić', 'Ulcinj'];

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Browse</Text>

        <Text style={styles.sectionTitle}>By Specialty</Text>
        <View style={styles.grid}>
          {POPULAR.map((item) => (
            <TouchableOpacity key={item.label} activeOpacity={0.8} style={styles.gridItem}>
              <View style={styles.gridIcon}>
                <Ionicons name={item.icon as any} size={28} color={Colors.primary} />
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>By City</Text>
        <View style={styles.cityList}>
          {CITIES.map((city) => (
            <TouchableOpacity key={city} activeOpacity={0.8} style={styles.cityItem}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.cityLabel}>{city}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.base04} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  title: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 28,
    color: Colors.text01,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 16,
    color: Colors.text01,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: Colors.base01,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.base04,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: Colors.text01,
    textAlign: 'center',
  },
  cityList: { gap: Spacing.xs },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.base01,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.base04,
    padding: Spacing.lg,
  },
  cityLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: Colors.text01,
  },
});
