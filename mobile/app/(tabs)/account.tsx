import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'My Profile' },
  { icon: 'briefcase-outline', label: 'My Services' },
  { icon: 'star-outline', label: 'Reviews' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'settings-outline', label: 'Settings' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
];

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.base04} />
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.guestContainer}>
          <View style={styles.guestIcon}>
            <Ionicons name="person-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.guestTitle}>Sign in to your account</Text>
          <Text style={styles.guestSubtitle}>
            Create a profile, offer your services and connect with clients in Montenegro
          </Text>
          <Button
            label="Log In"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/auth/login')}
          />
          <Button
            label="Sign Up"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/auth/register')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>U</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>User</Text>
            <Text style={styles.profileEmail}>user@example.com</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          {MENU_ITEMS.map((item) => (
            <MenuItem key={item.label} icon={item.icon} label={item.label} />
          ))}
        </View>

        <Button
          label="Sign Out"
          variant="outline"
          size="md"
          fullWidth
          onPress={signOut}
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  guestContainer: {
    flex: 1,
    padding: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  guestIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  guestTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    color: Colors.text01,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.text03,
    textAlign: 'center',
    lineHeight: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.base01,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.base04,
    padding: Spacing.xl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, color: Colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: Colors.text01 },
  profileEmail: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.text03 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    backgroundColor: Colors.base01,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.base04,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.text01 },
});
