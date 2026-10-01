import { describe, expect, it } from 'vitest';

import { businessHref, navItemsForRole } from './business-nav';

describe('business-nav', () => {
  it('hides Team and Settings for STAFF', () => {
    const keys = navItemsForRole('STAFF').map((i) => i.key);
    expect(keys).toContain('overview');
    expect(keys).toContain('schedule');
    expect(keys).not.toContain('team');
    expect(keys).not.toContain('settings');
  });

  it('shows Team and Settings for OWNER and ADMIN', () => {
    expect(navItemsForRole('OWNER').map((i) => i.key)).toEqual(
      expect.arrayContaining(['team', 'settings']),
    );
    expect(navItemsForRole('ADMIN').map((i) => i.key)).toEqual(
      expect.arrayContaining(['team', 'settings']),
    );
  });

  it('builds overview and nested hrefs', () => {
    expect(businessHref('en', 'b1', '')).toBe('/en/business/b1');
    expect(businessHref('ru', 'b1', 'team')).toBe('/ru/business/b1/team');
  });
});
