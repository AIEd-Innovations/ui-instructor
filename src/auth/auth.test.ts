import { describe, expect, it } from 'vitest';
import { REDIRECT_PATH, SignInError, authSettings, describeAuthError, isAllowedEmail } from './auth';

describe('describeAuthError', () => {
  it("finds Microsoft's AADSTS code in a server error and explains it", () => {
    const error = describeAuthError({
      errorCode: 'invalid_request',
      errorMessage: "AADSTS50011: The redirect URI 'http://localhost:5173' does not match.",
      correlationId: 'abc-123',
    });
    expect(error).toBeInstanceOf(SignInError);
    expect(error.code).toBe('AADSTS50011');
    expect(error.message).toContain('Single-page application');
    expect(error.details).toContain('Microsoft code: AADSTS50011');
    expect(error.details).toContain('Correlation ID: abc-123');
  });

  it('points admin-approval errors at Cal Poly ITS', () => {
    const error = describeAuthError({ errorCode: 'access_denied', errorMessage: 'AADSTS90094: Admin consent is required.' });
    expect(error.message).toContain('identity-management@calpoly.edu');
  });

  it("explains MSAL's own errors, such as the bridge timing out", () => {
    const error = describeAuthError({ errorCode: 'timed_out', subError: 'redirect_bridge_timeout' });
    expect(error.code).toBe('timed_out');
    expect(error.message).toContain('redirect URI');
    expect(error.details).toContain('timed_out (redirect_bridge_timeout)');
  });

  it('still reports an unknown Microsoft code', () => {
    expect(describeAuthError({ errorMessage: 'AADSTS12345: Something new.' }).message).toContain('AADSTS12345');
    expect(describeAuthError(new Error('boom')).message).toBe('Microsoft sign-in failed.');
  });
});

describe('authSettings', () => {
  it('shows the exact redirect URI to register for this origin', () => {
    expect(authSettings('http://localhost:5173').redirectUri).toBe(`http://localhost:5173${REDIRECT_PATH}`);
    expect(authSettings('http://localhost:5173').flow).toBe('redirect');
  });
});

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
