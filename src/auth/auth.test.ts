import { describe, expect, it } from 'vitest';
import { isAllowedEmail } from './auth';

describe('isAllowedEmail', () => {
  it('accepts an address in the allowed domain, ignoring case and spaces', () => {
    expect(isAllowedEmail('pkalathas@calpoly.edu', 'calpoly.edu')).toBe(true);
    expect(isAllowedEmail('  PKalathas@CalPoly.EDU ', 'calpoly.edu')).toBe(true);
  });

  it('rejects other domains, including look-alikes and subdomains', () => {
    expect(isAllowedEmail('someone@gmail.com', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('someone@outlook.com', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('x@calpoly.edu.evil.com', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('x@evilcalpoly.edu', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('x@mail.calpoly.edu', 'calpoly.edu')).toBe(false);
  });

  it('rejects empty and malformed input', () => {
    expect(isAllowedEmail('', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('calpoly.edu', 'calpoly.edu')).toBe(false);
    expect(isAllowedEmail('@calpoly.edu', 'calpoly.edu')).toBe(false);
  });
});
