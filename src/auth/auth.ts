// Sign-in with a Microsoft account, restricted to Cal Poly.
//
// Uses MSAL (the Microsoft sign-in library) with the popup flow. Nothing is stored in the
// browser: the MSAL cache is in memory, so reloading the page signs the user out.
//
// The domain check below is a convenience for the person signing in. It is NOT access control:
// anyone can edit this page's JavaScript. Real enforcement is the Azure app registration
// being limited to the Cal Poly tenant (VITE_MS_TENANT_ID) and, later, each service verifying
// the ID token it is sent. The services do not do that yet.

import type { IPublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID: string = import.meta.env.VITE_MS_CLIENT_ID ?? '';
// The Cal Poly directory (tenant) ID. 'organizations' lets any work or school account through
// the Microsoft step, so the domain check is then the only gate; set the real ID.
const TENANT_ID: string = import.meta.env.VITE_MS_TENANT_ID ?? 'organizations';
export const ALLOWED_EMAIL_DOMAIN: string = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ?? 'calpoly.edu').toLowerCase();

export const microsoftConfigured = CLIENT_ID !== '';

export interface SignedInUser {
  name: string;
  email: string;
}

/** True only for an address that ends in exactly "@<domain>" (so "x@calpoly.edu.evil.com" fails). */
export function isAllowedEmail(email: string, domain: string = ALLOWED_EMAIL_DOMAIN): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  return at > 0 && address.slice(at + 1) === domain.toLowerCase();
}

export class SignInError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SignInError';
  }
}

let client: Promise<IPublicClientApplication> | null = null;

function getClient(): Promise<IPublicClientApplication> {
  // Loaded on first sign-in so the library stays out of the main bundle.
  client ??= import('@azure/msal-browser').then(({ createStandardPublicClientApplication }) =>
    createStandardPublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'memoryStorage' },
    }),
  );
  return client;
}

/** Opens the Microsoft sign-in popup and accepts only an address in the allowed domain. */
export async function signIn(): Promise<SignedInUser> {
  if (!microsoftConfigured) throw new SignInError('Microsoft sign-in is not configured (VITE_MS_CLIENT_ID is not set).');
  const app = await getClient();

  let account;
  try {
    const result = await app.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
    account = result.account;
  } catch (e) {
    const code = (e as { errorCode?: string }).errorCode;
    if (code === 'user_cancelled') throw new SignInError('Sign-in was cancelled.', e);
    if (code === 'popup_window_error' || code === 'empty_window_error') {
      throw new SignInError('The sign-in window was blocked. Allow pop-ups for this site and try again.', e);
    }
    throw new SignInError('Microsoft sign-in failed. Try again.', e);
  }

  const email = account.username;
  if (!isAllowedEmail(email)) {
    await signOut().catch(() => undefined);
    throw new SignInError(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in. ${email} is not one.`);
  }
  return { name: account.name || email, email };
}

/** Forgets the signed-in account. Does not sign the person out of Microsoft itself. */
export async function signOut(): Promise<void> {
  if (!client) return;
  const app = await client;
  for (const account of app.getAllAccounts()) {
    await app.clearCache({ account });
  }
  app.setActiveAccount(null);
}
