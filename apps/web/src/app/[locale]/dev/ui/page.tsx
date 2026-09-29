import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { UiShowcase } from '@/features/dev/ui-showcase';

/** Development-only component gallery. Production builds return 404 (see docs/specs/44-web-ui-kit.md). */
export default function DevUiPage(): ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <UiShowcase />;
}
