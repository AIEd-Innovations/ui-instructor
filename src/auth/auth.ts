// Sign-in with a Microsoft account, restricted to Cal Poly.
//
// Uses MSAL (the Microsoft sign-in library). MSAL v5 needs a dedicated return page that runs its
// "redirect bridge" (redirect.html, src/auth/redirect.ts): Microsoft sends the result there and the
// bridge hands it back to this page. Without that page a popup never completes.
//
// Two flows, chosen with VITE_MS_LOGIN_FLOW:
//   redirect (default): the whole tab goes to Microsoft and comes back. Most reliable, works in Safari.
//   popup: Microsoft opens in a popup window and the page stays put.
//
// The domain check below is a convenience for the person signing in. It is NOT access control:
// anyone can edit this page's JavaScript. Real enforcement is the tenant restriction
// (VITE_MS_TENANT_ID) and each service verifying the ID token it is sent.

import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID: string = import.meta.env.VITE_MS_CLIENT_ID ?? '';
// The Cal Poly directory (tenant) ID. 'organizations' lets any work or school account through
// the Microsoft step, so the domain check is then the only gate; set the real ID.
const TENANT_ID: string = import.meta.env.VITE_MS_TENANT_ID ?? 'organizations';
export const ALLOWED_EMAIL_DOMAIN: string = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ?? 'calpoly.edu').toLowerCase();
export const SIGN_IN_FLOW: 'redirect' | 'popup' = import.meta.env.VITE_MS_LOGIN_FLOW === 'popup' ? 'popup' : 'redirect';

/** Where Microsoft sends the sign-in result. Register exactly this URI (per origin) as a Single-page application redirect URI. */
export const REDIRECT_PATH = '/redirect.html';

export const microsoftConfigured = CLIENT_ID !== '';

const SCOPES = ['openid', 'profile', 'email'];

export interface SignedInUser {
  name: string;
  email: string;
}

/** The settings in use, shown on the sign-in page so a failed test can be checked against the app registration. */
export function authSettings(origin: string = window.location.origin) {
  return {
    clientId: CLIENT_ID || '(not set)',
    tenant: TENANT_ID,
    flow: SIGN_IN_FLOW,
    redirectUri: origin + REDIRECT_PATH,
    allowedDomain: ALLOWED_EMAIL_DOMAIN,
  };
}

/** True only for an address that ends in exactly "@<domain>" (so "x@calpoly.edu.evil.com" fails). */
export function isAllowedEmail(email: string, domain: string = ALLOWED_EMAIL_DOMAIN): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  return at > 0 && address.slice(at + 1) === domain.toLowerCase();
}

export class SignInError extends Error {
  /** Microsoft's error code (AADSTS…) or MSAL's, for troubleshooting. */
  readonly code: string | null;
  readonly details: string;

  constructor(message: string, code: string | null = null, details = '', cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SignInError';
    this.code = code;
    this.details = details;
  }
}

// What each Microsoft (AADSTS) error means for this app, and what fixes it.
const AADSTS_HELP: Record<string, string> = {
  AADSTS50011:
    'The redirect URI is not registered. In the app registration, add this page’s redirect URI (shown below) under Single-page application.',
  AADSTS500113: 'The app registration has no redirect URI. Add the one shown below under Single-page application.',
  AADSTS9002326:
    'The redirect URI is registered under "Web" instead of "Single-page application". Move it to Single-page application.',
  AADSTS7000218:
    'The redirect URI is registered under "Web" instead of "Single-page application". Move it to Single-page application.',
  AADSTS700016:
    'Cal Poly’s directory does not know this app. The client ID is wrong, or the app is registered in another directory as single-tenant: make it multitenant ("Accounts in any organizational directory").',
  AADSTS50194:
    'The app is single-tenant but sign-in used a shared endpoint. Set VITE_MS_TENANT_ID to the directory the app is registered in, or make the app multitenant.',
  AADSTS50020:
    'This account is not in the directory sign-in was sent to. Set VITE_MS_TENANT_ID to Cal Poly’s tenant (1b0d02db-fc9e-4495-9537-1d379cca2ae7) and sign in with an @calpoly.edu account.',
  AADSTS65001:
    'Nobody has consented to the app yet. If Microsoft offers a consent screen, accept it; if it asks for admin approval, Cal Poly ITS has to approve the app.',
  AADSTS65004: 'The consent screen was declined. Sign in again and accept it.',
  AADSTS90094:
    'Cal Poly requires an administrator to approve this app before anyone can sign in. Ask Cal Poly ITS (identity-management@calpoly.edu) for admin consent.',
  AADSTS90095:
    'Cal Poly requires an administrator to approve this app before anyone can sign in. Ask Cal Poly ITS (identity-management@calpoly.edu) for admin consent.',
  AADSTS50105:
    'Cal Poly only lets assigned users into this app. Cal Poly ITS has to assign users or turn off "assignment required" for it.',
  AADSTS53003: 'A Cal Poly access policy (Conditional Access) blocked this sign-in. Cal Poly ITS has to allow the app.',
  AADSTS50076: 'Cal Poly requires multi-factor authentication. Complete the Duo step and try again.',
};

const MSAL_HELP: Record<string, string> = {
  user_cancelled: 'Sign-in was cancelled.',
  user_canceled: 'Sign-in was cancelled.',
  popup_window_error: 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
  empty_window_error: 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
  timed_out:
    'Microsoft never handed the result back. Usually the redirect URI below is not registered, redirect.html is not being served, or the popup was closed.',
  interaction_in_progress: 'A sign-in is already in progress. Finish or close it, then try again.',
  no_network_connectivity: 'No network connection. Check your connection and try again.',
  redirect_bridge_empty_response: 'The sign-in return page (redirect.html) did not pass the result back. Check that it is deployed unchanged.',
};

/** Turn whatever MSAL threw into a SignInError with a readable message, Microsoft's code and the raw details. */
export function describeAuthError(error: unknown): SignInError {
  const e = (error ?? {}) as { errorCode?: string; subError?: string; errorMessage?: string; correlationId?: string; message?: string };
  const raw = [e.errorCode, e.subError, e.errorMessage, e.message].filter(Boolean).join(' | ');
  const aadsts = raw.match(/AADSTS\d+/)?.[0] ?? null;
  const details = [
    aadsts && `Microsoft code: ${aadsts}`,
    e.errorCode && `MSAL code: ${e.errorCode}${e.subError ? ` (${e.subError})` : ''}`,
    e.errorMessage && `Message: ${e.errorMessage}`,
    e.correlationId && `Correlation ID: ${e.correlationId}`,
  ].filter(Boolean).join('\n');

  const help = (aadsts && AADSTS_HELP[aadsts]) || (e.errorCode && MSAL_HELP[e.errorCode]);
  const message = help ?? (aadsts ? `Microsoft refused the sign-in (${aadsts}).` : 'Microsoft sign-in failed.');
  return new SignInError(message, aadsts ?? e.errorCode ?? null, details, error);
}

let client: Promise<IPublicClientApplication> | null = null;

function getClient(): Promise<IPublicClientApplication> {
  // Loaded on first use so the library stays out of the main bundle.
  client ??= import('@azure/msal-browser').then(({ createStandardPublicClientApplication }) =>
    createStandardPublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin + REDIRECT_PATH,
      },
      // The redirect flow leaves the page, so its state has to survive in this tab's sessionStorage.
      // The popup flow keeps everything in memory: reloading the page signs out.
      cache: { cacheLocation: SIGN_IN_FLOW === 'redirect' ? 'sessionStorage' : 'memoryStorage' },
    }),
  );
  return client;
}

function toUser(account: AccountInfo): SignedInUser {
  const email = account.username;
  if (!isAllowedEmail(email)) {
    throw new SignInError(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in. ${email} is not one.`, 'wrong_domain');
  }
  return { name: account.name || email, email };
}

async function rejectAccount(app: IPublicClientApplication, error: unknown): Promise<never> {
  await clearAccounts(app);
  throw error;
}

/**
 * Start signing in. With the popup flow this resolves with the user. With the redirect flow the tab
 * leaves for Microsoft and this never resolves; `resumeSignIn` picks up the result when it returns.
 */
export async function signIn(): Promise<SignedInUser> {
  if (!microsoftConfigured) throw new SignInError('Microsoft sign-in is not configured (VITE_MS_CLIENT_ID is not set).');
  const app = await getClient();
  const request = { scopes: SCOPES, prompt: 'select_account' };

  if (SIGN_IN_FLOW === 'redirect') {
    try {
      await app.loginRedirect(request);
    } catch (e) {
      throw describeAuthError(e);
    }
    return new Promise<never>(() => {});
  }

  let account: AccountInfo;
  try {
    account = (await app.loginPopup(request)).account;
  } catch (e) {
    throw describeAuthError(e);
  }
  try {
    const user = toUser(account);
    app.setActiveAccount(account);
    return user;
  } catch (e) {
    return rejectAccount(app, e);
  }
}

/**
 * On page load: finish a redirect sign-in that just came back, or restore the account already signed
 * in this tab. Null when nobody is signed in. Throws a SignInError if Microsoft returned an error.
 */
export function resumeSignIn(): Promise<SignedInUser | null> {
  // Once per page load: the redirect result can only be handled once (React runs effects twice in development).
  resumed ??= resume();
  return resumed;
}

let resumed: Promise<SignedInUser | null> | null = null;

async function resume(): Promise<SignedInUser | null> {
  if (!microsoftConfigured) return null;
  const app = await getClient();
  let account: AccountInfo | null;
  try {
    const result = await app.handleRedirectPromise();
    account = result?.account ?? app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
  } catch (e) {
    throw describeAuthError(e);
  }
  if (!account) return null;
  try {
    const user = toUser(account);
    app.setActiveAccount(account);
    return user;
  } catch (e) {
    return rejectAccount(app, e);
  }
}

/**
 * The signed-in user's Microsoft ID token, refreshed when needed, for the agents to verify.
 * Null when nobody is signed in with Microsoft (development sign-in).
 */
export async function getIdToken(): Promise<string | null> {
  if (!microsoftConfigured || !client) return null;
  const app = await client;
  const account = app.getActiveAccount();
  if (!account) return null;
  try {
    return (await app.acquireTokenSilent({ scopes: SCOPES, account })).idToken || null;
  } catch {
    return null;
  }
}

/** `headers` plus `Authorization: Bearer <ID token>` when signed in with Microsoft, so the agents can check who is calling. */
export async function authHeaders(headers?: HeadersInit): Promise<Record<string, string>> {
  const merged: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  const token = await getIdToken();
  if (token) merged.Authorization = `Bearer ${token}`;
  return merged;
}

async function clearAccounts(app: IPublicClientApplication): Promise<void> {
  for (const account of app.getAllAccounts()) {
    await app.clearCache({ account });
  }
  app.setActiveAccount(null);
}

/** Forgets the signed-in account. Does not sign the person out of Microsoft itself. */
export async function signOut(): Promise<void> {
  resumed = Promise.resolve(null);
  if (!client) return;
  await clearAccounts(await client);
}
