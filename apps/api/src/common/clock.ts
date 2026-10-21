import { Injectable } from '@nestjs/common';

/** Injectable wall clock so scheduling / business logic never calls `Date.now()` directly. */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** Fixed clock for tests; `set` lets e2e suites advance "now" without rebuilding the module. */
export class FixedClock extends Clock {
  private instant: Date;

  constructor(instant: Date) {
    super();
    this.instant = instant;
  }

  now(): Date {
    return new Date(this.instant.getTime());
  }

  set(instant: Date): void {
    this.instant = instant;
  }
}
