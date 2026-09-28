import { catalogs } from '@najme/i18n';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { ApiStatusBadge } from './api-status-badge';

const messages = catalogs.en.common;

describe('ApiStatusBadge', () => {
  it('renders the localized "online" text when the API is healthy', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ApiStatusBadge online={true} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(messages.apiStatus.online);
  });

  it('renders the localized "unavailable" text when the API is unreachable', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ApiStatusBadge online={false} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(messages.apiStatus.unavailable);
  });
});
