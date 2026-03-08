import { describe, it, expect } from 'vitest';
import { NotFoundError, BusinessRuleError, ConflictError } from '../src/lib/errors';

describe('lib/errors', () => {
  it('NotFoundError has name, message and code', () => {
    const err = new NotFoundError('Advisor not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotFoundError');
    expect(err.message).toBe('Advisor not found');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('BusinessRuleError uses default code', () => {
    const err = new BusinessRuleError('Slot unavailable');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BusinessRuleError');
    expect(err.message).toBe('Slot unavailable');
    expect(err.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('BusinessRuleError accepts custom code', () => {
    const err = new BusinessRuleError('Hold expired', 'HOLD_EXPIRED');
    expect(err.code).toBe('HOLD_EXPIRED');
  });

  it('ConflictError uses default code', () => {
    const err = new ConflictError('Slot taken');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictError');
    expect(err.message).toBe('Slot taken');
    expect(err.code).toBe('CONFLICT');
  });

  it('ConflictError accepts custom code', () => {
    const err = new ConflictError('Duplicate', 'DUPLICATE_REQUEST');
    expect(err.code).toBe('DUPLICATE_REQUEST');
  });
});
