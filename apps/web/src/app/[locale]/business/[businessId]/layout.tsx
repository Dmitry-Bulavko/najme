'use client';

import type { ReactNode } from 'react';
import { use } from 'react';

import { BusinessShell } from '@/features/business/business-shell';

export default function BusinessLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ businessId: string }>;
}): ReactNode {
  const { businessId } = use(params);
  return <BusinessShell businessId={businessId}>{children}</BusinessShell>;
}
