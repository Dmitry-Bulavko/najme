import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/colors';
import type { Profile } from '@najme/shared';

const CATEGORY_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  babysitting: 'Babysitting',
  technical: 'Technical',
  massage: 'Massage',
  repair: 'Repair',
  other: 'Other',
};

type Props = {
  profile: Profile;
  onPress?: () => void;
};

export function ProfileCard({ profile, onPress }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{profile.name[0]}</Text>
          )}
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            {profile.verified && (
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {CATEGORY_LABELS[profile.category] ?? profile.category}
              </Text>
            </View>
            <Ionicons name="location-outline" size={13} color={Colors.text03} />
            <Text style={styles.metaText}>{profile.city}</Text>
          </View>
        </View>

        {profile.hourlyRate != null && (
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{profile.hourlyRate} {profile.currency ?? 'EUR'}</Text>
            <Text style={styles.perHour}>/hr</Text>
          </View>
        )}
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {profile.description}
      </Text>

      {profile.rating != null && (
        <View style={styles.footer}>
          <Ionicons name="star" size={13} color="#FBBF24" />
          <Text style={styles.rating}>{profile.rating.toFixed(1)}</Text>
          {profile.reviewCount != null && (
            <Text style={styles.reviews}>({profile.reviewCount} reviews)</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.base01,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.base04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, color: Colors.primary },
  headerInfo: { flex: 1, gap: Spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: Colors.text01, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  badge: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 11, color: Colors.primary },
  metaText: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: Colors.text03 },
  priceBlock: { alignItems: 'flex-end', flexShrink: 0 },
  price: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: Colors.text01 },
  perHour: { fontFamily: 'Manrope_500Medium', fontSize: 11, color: Colors.text03 },
  description: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.text03,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13, color: Colors.text01 },
  reviews: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: Colors.text03 },
});
