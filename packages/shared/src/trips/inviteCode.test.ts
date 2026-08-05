import { describe, expect, it } from 'vitest';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from './inviteCode';

const AMBIGUOUS = ['0', 'O', '1', 'I', 'L'];

describe('generateInviteCode', () => {
  it('produces a 6-char code by default', () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it('respects a custom length', () => {
    expect(generateInviteCode(8)).toHaveLength(8);
  });

  it('never emits visually ambiguous characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      for (const ch of AMBIGUOUS) expect(code).not.toContain(ch);
    }
  });

  it('is reasonably unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(generateInviteCode());
    // Collisions in 500 draws over 31^6 space should be effectively nil.
    expect(seen.size).toBe(500);
  });
});

describe('normalizeInviteCode', () => {
  it('uppercases and strips spaces/dashes', () => {
    expect(normalizeInviteCode(' ab2-cd3 ')).toBe('AB2CD3');
  });

  it('drops ambiguous characters entirely', () => {
    expect(normalizeInviteCode('A1B0C')).toBe('ABC');
  });
});

describe('isValidInviteCode', () => {
  it('accepts a well-formed code regardless of case/spacing', () => {
    const code = generateInviteCode();
    expect(isValidInviteCode(code.toLowerCase())).toBe(true);
    expect(isValidInviteCode(` ${code} `)).toBe(true);
  });

  it('rejects wrong-length or junk input', () => {
    expect(isValidInviteCode('')).toBe(false);
    expect(isValidInviteCode('ABC')).toBe(false);
    expect(isValidInviteCode('11111111')).toBe(false); // all ambiguous → empty
  });
});
