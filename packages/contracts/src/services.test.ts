import { describe, expect, it } from 'vitest';

import {
  createServiceRequestSchema,
  serviceCustomFieldSchema,
  updateServiceRequestSchema,
} from './services.js';

describe('serviceCustomFieldSchema SELECT options', () => {
  it('requires 1–20 unique {value,label} options', () => {
    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'intensity',
        label: 'Intensity',
        type: 'SELECT',
        required: true,
        options: [{ value: 'soft', label: 'Soft' }],
      }).success,
    ).toBe(true);

    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'intensity',
        label: 'Intensity',
        type: 'SELECT',
        required: true,
        options: [],
      }).success,
    ).toBe(false);

    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'intensity',
        label: 'Intensity',
        type: 'SELECT',
        required: true,
        options: Array.from({ length: 21 }, (_, i) => ({
          value: `v${i}`,
          label: `L${i}`,
        })),
      }).success,
    ).toBe(false);

    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'intensity',
        label: 'Intensity',
        type: 'SELECT',
        required: true,
        options: [
          { value: 'soft', label: 'Soft' },
          { value: 'soft', label: 'Soft 2' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects options on TEXT/NUMBER and bad keys', () => {
    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'notes',
        label: 'Notes',
        type: 'TEXT',
        required: false,
        options: [{ value: 'x', label: 'X' }],
      }).success,
    ).toBe(false);
    expect(
      serviceCustomFieldSchema.safeParse({
        key: 'BadKey',
        label: 'Bad',
        type: 'TEXT',
        required: false,
      }).success,
    ).toBe(false);
  });
});

describe('createServiceRequestSchema', () => {
  const base = {
    name: 'Cut',
    durationMinutes: 30,
    price: { amount: 1500, currency: 'EUR' as const },
  };

  it('rejects off-grid duration, non-EUR, negative amount, and duplicate staff ids', () => {
    expect(createServiceRequestSchema.safeParse({ ...base, durationMinutes: 7 }).success).toBe(
      false,
    );
    expect(
      createServiceRequestSchema.safeParse({
        ...base,
        price: { amount: 100, currency: 'USD' },
      }).success,
    ).toBe(false);
    expect(
      createServiceRequestSchema.safeParse({
        ...base,
        price: { amount: -1, currency: 'EUR' },
      }).success,
    ).toBe(false);
    const id = '11111111-1111-4111-8111-111111111111';
    expect(
      createServiceRequestSchema.safeParse({
        ...base,
        staffMemberIds: [id, id],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate custom field keys and more than 10 fields', () => {
    expect(
      createServiceRequestSchema.safeParse({
        ...base,
        customFields: [
          { key: 'a', label: 'A', type: 'TEXT', required: false },
          { key: 'a', label: 'B', type: 'TEXT', required: false },
        ],
      }).success,
    ).toBe(false);
    expect(
      createServiceRequestSchema.safeParse({
        ...base,
        customFields: Array.from({ length: 11 }, (_, i) => ({
          key: `f${i}`,
          label: `F${i}`,
          type: 'TEXT' as const,
          required: false,
        })),
      }).success,
    ).toBe(false);
  });

  it('rejects an empty update body', () => {
    expect(updateServiceRequestSchema.safeParse({}).success).toBe(false);
  });
});
