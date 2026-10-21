/**
 * Dev seed must never run against a production database. Callers pass `process.env.NODE_ENV`
 * (or a test double) so the check stays pure and unit-testable.
 */
export function assertNotProductionEnv(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'Refusing to run the Najme dev seed when NODE_ENV=production. Use a non-production environment.',
    );
  }
}
