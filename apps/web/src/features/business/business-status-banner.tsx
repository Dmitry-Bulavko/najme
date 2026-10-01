'use client';

import { businessSchema, type Business, type BusinessStatus } from '@najme/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { cn } from '@/lib/utils';

type StatusBannerProps = {
  business: Business;
  onUpdated: (business: Business) => void;
};

const TONE: Record<BusinessStatus, string> = {
  PENDING_APPROVAL: 'border-primary/30 bg-secondary',
  REJECTED: 'border-destructive/40 bg-destructive/10',
  APPROVED: 'border-primary/40 bg-secondary',
  SUSPENDED: 'border-border bg-muted',
};

/**
 * Moderation status strip on the business overview (R11). OWNER/ADMIN can resubmit REJECTED.
 */
export function BusinessStatusBanner({ business, onUpdated }: StatusBannerProps) {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const [busy, setBusy] = useState(false);
  const canResubmit =
    business.status === 'REJECTED' && (business.myRole === 'OWNER' || business.myRole === 'ADMIN');

  async function resubmit(): Promise<void> {
    setBusy(true);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/resubmit`, {
        method: 'POST',
      });
      onUpdated(businessSchema.parse(raw));
      toast.success(t('status.resubmitToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusy(false);
    }
  }

  const titleKey = {
    PENDING_APPROVAL: 'status.pendingTitle',
    REJECTED: 'status.rejectedTitle',
    APPROVED: 'status.approvedTitle',
    SUSPENDED: 'status.suspendedTitle',
  }[business.status] as
    | 'status.pendingTitle'
    | 'status.rejectedTitle'
    | 'status.approvedTitle'
    | 'status.suspendedTitle';

  const bodyKey = (
    business.status === 'REJECTED' && !business.rejectionReason
      ? 'status.rejectedBodyNoReason'
      : {
          PENDING_APPROVAL: 'status.pendingBody',
          REJECTED: 'status.rejectedBody',
          APPROVED: 'status.approvedBody',
          SUSPENDED: 'status.suspendedBody',
        }[business.status]
  ) as
    | 'status.pendingBody'
    | 'status.rejectedBody'
    | 'status.rejectedBodyNoReason'
    | 'status.approvedBody'
    | 'status.suspendedBody';

  return (
    <div role="status" className={cn('rounded-md border p-4', TONE[business.status])}>
      <p className="font-bold text-foreground">{t(titleKey)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(bodyKey)}</p>
      {business.status === 'REJECTED' && business.rejectionReason ? (
        <p className="mt-2 text-sm text-foreground">{business.rejectionReason}</p>
      ) : null}
      {canResubmit ? (
        <Button className="mt-3" size="sm" disabled={busy} onClick={() => void resubmit()}>
          {busy ? t('status.resubmitting') : t('status.resubmit')}
        </Button>
      ) : null}
    </div>
  );
}
