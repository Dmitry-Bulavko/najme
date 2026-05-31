import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Colors, Radius, Spacing } from '@/constants/colors';
import { Button } from '@/components/ui/button';
import { profilesApi } from '@/lib/api';
import type { Profile } from '@najme/shared';

const WORK_FORMAT_LABELS: Record<string, string> = {
    ONSITE: 'On-site',
    REMOTE: 'Remote',
    BOTH: 'On-site & Remote',
};

export default function ProfileDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;
        profilesApi
            .getById(id)
            .then(setProfile)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !profile) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={Colors.base04} />
                    <Text style={styles.errorText}>Profile not found</Text>
                    <Button label="Go Back" variant="secondary" size="md" onPress={() => router.back()} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.text01} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={styles.heroCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarLetter}>{profile.name[0]}</Text>
                    </View>
                    <View style={styles.heroInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{profile.name}</Text>
                            {profile.verified && (
                                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                            )}
                        </View>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{profile.category}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={14} color={Colors.text03} />
                            <Text style={styles.metaText}>{profile.cities.join(', ')}</Text>
                            {profile.rating != null && profile.rating > 0 && (
                                <>
                                    <Text style={styles.dot}>·</Text>
                                    <Ionicons name="star" size={14} color="#FBBF24" />
                                    <Text style={styles.metaText}>
                                        {profile.rating.toFixed(1)} ({profile.reviewCount})
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.description}>{profile.description}</Text>
                </View>

                {/* Experience */}
                {profile.experience && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Experience</Text>
                        <Text style={styles.description}>{profile.experience}</Text>
                    </View>
                )}

                {/* Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    {profile.workFormat && (
                        <DetailRow label="Work format" value={WORK_FORMAT_LABELS[profile.workFormat] ?? profile.workFormat} />
                    )}
                </View>

                {/* Contacts */}
                {profile.contactInfo && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contacts</Text>
                        {profile.contactInfo.phone && (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${profile.contactInfo!.phone}`)}>
                                <DetailRow label="Phone" value={profile.contactInfo.phone} />
                            </TouchableOpacity>
                        )}
                        {profile.contactInfo.whatsapp && (
                            <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${profile.contactInfo!.whatsapp}`)}>
                                <DetailRow label="WhatsApp" value={profile.contactInfo.whatsapp} />
                            </TouchableOpacity>
                        )}
                        {profile.contactInfo.telegram && (
                            <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${profile.contactInfo!.telegram}`)}>
                                <DetailRow label="Telegram" value={`@${profile.contactInfo.telegram}`} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={styles.bottomSpace} />
            </ScrollView>

            <View style={styles.cta}>
                <View>
                    {profile.hourlyRate != null && (
                        <>
                            <Text style={styles.ctaPrice}>
                                {profile.hourlyRate} {profile.currency}/hr
                            </Text>
                            <Text style={styles.ctaLabel}>Hourly rate</Text>
                        </>
                    )}
                </View>
                <Button
                    label="Write a message"
                    variant="primary"
                    size="lg"
                    style={styles.ctaBtn}
                    onPress={() => router.push(`/messages?profileId=${profile.id}` as any)}
                />
            </View>
        </SafeAreaView>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xxxl },
    errorText: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.text03 },
    backBtn: { padding: Spacing.xl },
    heroCard: {
        flexDirection: 'row',
        gap: Spacing.lg,
        alignItems: 'flex-start',
        backgroundColor: Colors.base01,
        padding: Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Colors.base04,
    },
    avatar: {
        width: 64, height: 64, borderRadius: Radius.full,
        backgroundColor: Colors.secondary,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    avatarLetter: { fontFamily: 'Manrope_800ExtraBold', fontSize: 24, color: Colors.primary },
    heroInfo: { flex: 1, gap: Spacing.xs },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, color: Colors.text01, flex: 1 },
    badge: {
        alignSelf: 'flex-start', backgroundColor: Colors.secondary,
        borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    },
    badgeText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 12, color: Colors.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    metaText: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.text03 },
    dot: { color: Colors.base04 },
    section: {
        padding: Spacing.xl, borderBottomWidth: 1,
        borderBottomColor: Colors.base04, gap: Spacing.md,
    },
    sectionTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, color: Colors.text01 },
    description: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: Colors.text02, lineHeight: 22 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
    detailLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.text03 },
    detailValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13, color: Colors.text01 },
    bottomSpace: { height: 100 },
    cta: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: Colors.base01,
        borderTopWidth: 1, borderTopColor: Colors.base04,
        padding: Spacing.xl, paddingBottom: 34,
    },
    ctaPrice: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22, color: Colors.text01 },
    ctaLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: Colors.text03 },
    ctaBtn: { flex: 1, marginLeft: Spacing.xl },
});
