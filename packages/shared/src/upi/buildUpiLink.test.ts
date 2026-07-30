import { describe, expect, it } from 'vitest';
import { buildUpiLink, InvalidUpiParamsError } from './buildUpiLink';

describe('buildUpiLink', () => {
  it('builds a valid upi:// link with required fields', () => {
    const link = buildUpiLink({
      payeeVpa: 'alice@okhdfcbank',
      payeeName: 'Alice',
      amount: 100.5,
    });
    const url = new URL(link);
    expect(url.protocol).toBe('upi:');
    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('pa')).toBe('alice@okhdfcbank');
    expect(params.get('pn')).toBe('Alice');
    expect(params.get('am')).toBe('100.50');
    expect(params.get('cu')).toBe('INR');
  });

  it('includes note and transaction ref when provided', () => {
    const link = buildUpiLink({
      payeeVpa: 'bob@okaxis',
      payeeName: 'Bob',
      amount: 42,
      note: 'Trip dinner',
      transactionRefId: 'settle_123',
    });
    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('tn')).toBe('Trip dinner');
    expect(params.get('tr')).toBe('settle_123');
  });

  it('rejects a malformed VPA', () => {
    expect(() => buildUpiLink({ payeeVpa: 'not-a-vpa', payeeName: 'X', amount: 10 })).toThrow(
      InvalidUpiParamsError,
    );
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildUpiLink({ payeeVpa: 'a@okicici', payeeName: 'X', amount: 0 })).toThrow(
      InvalidUpiParamsError,
    );
  });
});
