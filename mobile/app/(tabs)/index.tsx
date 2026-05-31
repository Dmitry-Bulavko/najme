import {
    View,
    Text,
    FlatList,
    StyleSheet,
    SafeAreaView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { ProfileCard } from '@/components/profiles/profile-card';
import { Colors, Radius, Spacing } from '@/constants/colors';
import { profilesApi, categoriesApi } from '@/lib/api';
import type { Profile, Category } from '@najme/shared';

const STATIC_CATEGORIES = [{ key: '', label: 'All' }];

export default function HomeScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        categoriesApi.list().then(setCategories).catch(() => {});
    }, []);

    const fetchProfiles = useCallback(
        async (p: number, s: string, cat: string, replace = true) => {
            if (p === 1) setLoading(true);
            else setLoadingMore(true);
            try {
                const res = await profilesApi.list({
                    page: p,
                    pageSize: 10,
                    search: s || undefined,
                    category: cat || undefined,
                });
                if (replace) {
                    setProfiles(res.data);
                } else {
                    setProfiles((prev) => [...prev, ...res.data]);
                }
                setTotal(res.total);
                setPage(p);
            } catch {
                // ignore
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchProfiles(1, search, category);
    }, [category, fetchProfiles]);

    const handleSearch = () => fetchProfiles(1, search, category);

    const handleLoadMore = () => {
        if (!loadingMore && profiles.length < total) {
            fetchProfiles(page + 1, search, category, false);
        }
    };

    const categoryList = [
        ...STATIC_CATEGORIES,
        ...categories.map((c) => ({
            key: c.slug,
            label: (c.nameI18n as Record<string, string>)['en'] ?? c.slug,
        })),
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.logo}>
                    Najme<Text style={styles.logoDot}>.</Text>me
                </Text>
            </View>

            <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={Colors.text03} />
                <TextInput
                    placeholder="Search by name or specialty..."
                    placeholderTextColor={Colors.text03}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    style={styles.searchInput}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearch(''); fetchProfiles(1, '', category); }}>
                        <Ionicons name="close-circle" size={18} color={Colors.text03} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={categoryList}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(i) => i.key}
                contentContainerStyle={styles.categoryList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => setCategory(item.key)}
                        style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
                    >
                        <Text style={[styles.categoryLabel, category === item.key && styles.categoryLabelActive]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                )}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={profiles}
                    keyExtractor={(p) => p.id}
                    contentContainerStyle={styles.list}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    ListHeaderComponent={
                        <Text style={styles.count}>
                            {total} {total === 1 ? 'specialist' : 'specialists'} found
                        </Text>
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={48} color={Colors.base04} />
                            <Text style={styles.emptyText}>No specialists found</Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 16 }} />
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <ProfileCard profile={item} onPress={() => router.push(`/profile/${item.id}`)} />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    logo: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22, color: Colors.text01 },
    logoDot: { color: Colors.primary },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
        backgroundColor: Colors.base01,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.base04,
        paddingHorizontal: Spacing.lg,
        height: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    searchInput: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.text01 },
    categoryList: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
    categoryChip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Radius.full,
        backgroundColor: Colors.base01,
        borderWidth: 1,
        borderColor: Colors.base04,
    },
    categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    categoryLabel: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13, color: Colors.text01 },
    categoryLabelActive: { color: Colors.base01 },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
    count: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.text03, marginBottom: Spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.lg },
    emptyText: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.text03 },
});
