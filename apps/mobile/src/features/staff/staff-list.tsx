import {
  businessMemberListResponseSchema,
  staffMembersResponseSchema,
  type BusinessMember,
  type StaffMember,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar, Banner, Button, Screen, Text, confirm } from '@/components/ui';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { ApiError, apiRequest } from '@/lib/api/client';

function linkedLabel(
  staffId: string,
  members: BusinessMember[] | null,
  t: (key: string, values?: { name: string }) => string,
): string {
  if (!members) return t('business:staff.linkedUnknown');
  const member = members.find((m) => m.staffMemberId === staffId);
  if (!member) return t('business:staff.notLinked');
  return member.displayName?.trim() || member.email;
}

/** Staff list with photo, name, active flag, linked member; OWNER/ADMIN can create/edit/delete. */
export function StaffList(): ReactElement {
  const { t } = useTranslation(['business', 'common', 'errors']);
  const router = useRouter();
  const { business } = useBusinessContext();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const base = businessHref(business.id, '/staff');

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [members, setMembers] = useState<BusinessMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const staffRaw = await apiRequest<unknown>(`/businesses/${business.id}/staff`);
      setStaff(staffMembersResponseSchema.parse(staffRaw));
      if (canManage) {
        try {
          const membersRaw = await apiRequest<unknown>(`/businesses/${business.id}/members`);
          setMembers(businessMemberListResponseSchema.parse(membersRaw));
        } catch {
          setMembers(null);
        }
      } else {
        // STAFF cannot list members; treat as empty so the column shows “not linked”.
        setMembers([]);
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, canManage, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / business change
    void load();
  }, [load]);

  const empty = useMemo(() => staff !== null && staff.length === 0, [staff]);

  async function onDelete(member: StaffMember): Promise<void> {
    const ok = await confirm({
      title: t('business:staff.deleteTitle'),
      message: t('business:staff.deleteDescription', { name: member.displayName }),
      confirmLabel: t('business:staff.deleteConfirm'),
      cancelLabel: t('business:staff.deleteCancel'),
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(member.id);
    setToast(null);
    try {
      await apiRequest(`/businesses/${business.id}/staff/${member.id}`, { method: 'DELETE' });
      setToast(t('business:staff.deletedToast'));
      setStaff((prev) => prev?.filter((s) => s.id !== member.id) ?? null);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setToast(null);
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="title">{t('business:staff.heading')}</Text>
            <Text variant="caption" color="text03">
              {canManage ? t('business:staff.subtitle') : t('business:staff.readOnlySubtitle')}
            </Text>
          </View>
          {canManage ? (
            <Button
              label={t('business:staff.add')}
              onPress={() => router.push(`${base}/new`)}
              testID="staff-add"
            />
          ) : null}
        </View>

        {toast ? <Banner tone="success" message={toast} /> : null}
        {error && staff ? <Banner tone="error" message={error} /> : null}

        {loading ? (
          <View
            style={styles.centered}
            accessibilityLabel={t('business:staff.loading')}
            accessibilityState={{ busy: true }}
          >
            <ActivityIndicator color={tokens.colors.primary} />
          </View>
        ) : error && !staff ? (
          <View style={styles.centered}>
            <Banner tone="error" message={error} />
            <Button
              label={t('business:staff.retry')}
              variant="secondary"
              onPress={() => void load()}
            />
          </View>
        ) : empty ? (
          <View style={styles.centered} testID="staff-empty">
            <Text variant="body" color="text03">
              {t('business:staff.empty')}
            </Text>
            {canManage ? (
              <Button
                label={t('business:staff.emptyCta')}
                onPress={() => router.push(`${base}/new`)}
                testID="staff-empty-cta"
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {staff?.map((member) => (
              <View key={member.id} style={styles.row} testID={`staff-row-${member.id}`}>
                <Avatar name={member.displayName} uri={member.photoUrl} size={48} />
                <View style={styles.rowBody}>
                  <Text variant="body" numberOfLines={1}>
                    {member.displayName}
                  </Text>
                  <Text variant="caption" color="text03" numberOfLines={1}>
                    {t('business:staff.linkedLabel', {
                      name: linkedLabel(member.id, members, t),
                    })}
                  </Text>
                  <Text variant="caption" color={member.active ? 'text01' : 'text03'}>
                    {member.active ? t('business:staff.active') : t('business:staff.inactive')}
                  </Text>
                </View>
                {canManage ? (
                  <View style={styles.actions}>
                    <Button
                      label={t('business:staff.edit')}
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push(`${base}/${member.id}`)}
                    />
                    <Button
                      label={t('business:staff.delete')}
                      variant="destructive"
                      size="sm"
                      loading={deletingId === member.id}
                      disabled={deletingId === member.id}
                      onPress={() => void onDelete(member)}
                      testID={`staff-delete-${member.id}`}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg, padding: tokens.spacing.lg },
  header: { gap: tokens.spacing.md },
  headerText: { gap: tokens.spacing.xs },
  centered: {
    gap: tokens.spacing.md,
    alignItems: 'center',
    paddingVertical: tokens.spacing['2xl'],
  },
  list: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.base04,
  },
  rowBody: { flex: 1, gap: tokens.spacing.xs, minWidth: 0 },
  actions: { gap: tokens.spacing.xs },
});
