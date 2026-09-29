import { v7 } from 'uuid';

/** Generates a time-ordered UUID v7 primary key (docs/conventions/api.md). */
export function newId(): string {
  return v7();
}
