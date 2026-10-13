import { describe, expect, it } from 'vitest';

import { assertNotProductionEnv } from './assert-not-production.js';

describe('assertNotProductionEnv', () => {
  it('throws when NODE_ENV is production', () => {
    expect(() => assertNotProductionEnv('production')).toThrow(/NODE_ENV=production/);
  });

  it.each([undefined, '', 'development', 'test', 'staging'])('allows NODE_ENV=%s', (value) => {
    expect(() => assertNotProductionEnv(value)).not.toThrow();
  });
});
