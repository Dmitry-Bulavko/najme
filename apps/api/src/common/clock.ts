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

/** Fixed clock for tests. */
export class FixedClock extends Clock {
  constructor(private readonly instant: Date) {
    super();
  }

  now(): Date {
    return new Date(this.instant.getTime());
  }
}
