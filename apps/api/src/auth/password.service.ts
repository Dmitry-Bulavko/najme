import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id via `@node-rs/argon2` (prebuilt binaries, no install scripts). The library defaults are
 * the OWASP minimum for argon2id (m=19 MiB, t=2, p=1) and the algorithm defaults to argon2id, so no
 * options are passed; the parameters are encoded in each hash, so they can be raised later.
 */
@Injectable()
export class PasswordService {
  /** Verified against when the account does not exist, to equalize login timing. */
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // A malformed stored hash must not turn a login attempt into a 500.
      return false;
    }
  }

  /** Burns the same time as a real verification and always returns false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= hash('najme-timing-equalizer');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
