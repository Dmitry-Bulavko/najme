export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/** The provider did not verify the email, so it must not be linked to an existing account. */
export class UnverifiedProviderEmailError extends Error {
  constructor() {
    super('Provider email is not verified');
    this.name = 'UnverifiedProviderEmailError';
  }
}

/** The user already has a different identity for this provider (or the account is taken). */
export class IdentityConflictError extends Error {
  constructor() {
    super('Identity conflicts with an existing one');
    this.name = 'IdentityConflictError';
  }
}
