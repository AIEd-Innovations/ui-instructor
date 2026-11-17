# Microsoft sign-in (Cal Poly accounts)

Instructors sign in with their @calpoly.edu Microsoft account. Cal Poly's accounts live in Cal Poly's Microsoft
tenant `1b0d02db-fc9e-4495-9537-1d379cca2ae7` and are **managed** there (not federated to Shibboleth), so the
Microsoft sign-in page *is* the Cal Poly login, with Cal Poly branding and Duo.

The code is `src/auth/auth.ts` (MSAL), `redirect.html` + `src/auth/redirect.ts` (the return page MSAL v5 requires)
and `src/components/LoginPage.tsx`.

## 1. Register the app (once, about 5 minutes)

1. Go to <https://entra.microsoft.com> and sign in with your **@calpoly.edu** account.
2. **Identity → Applications → App registrations → New registration.**
   - **Cal Poly accounts get "You do not have access … Insufficient privileges" (401) here**: Cal Poly does not let
     users into the admin center or register apps. Either ask whoever already has a registration for its client ID, or
     register with a **personal** Microsoft account (outlook.com, hotmail, Xbox) at <https://portal.azure.com> →
     App registrations (a free Azure account works if it asks for a subscription) and pick the **multitenant** option
     in the next step. Or ask Cal Poly ITS (identity-management@calpoly.edu) to register it in Cal Poly's directory.
3. Fill in:
   - **Name:** AIEIC Instructor Panel
   - **Supported account types:**
     - registering inside Cal Poly's directory: *Accounts in this organizational directory only (Cal Poly)*
     - registering anywhere else: *Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)*
   - **Redirect URI:** platform **Single-page application** (not "Web"), URI `http://localhost:5173/redirect.html`
4. **Register**, then copy the **Application (client) ID** from the Overview page.
5. Later, for the deployed site: **Authentication → Single-page application → Add URI** →
   `https://<production domain>/redirect.html`. Vercel preview URLs change on every deploy and Microsoft does not
   allow wildcards, so sign-in only works on localhost and the production domain.

No client secret, certificate or extra API permission is needed: the app only asks for `openid profile email`.

## 2. Configure and run

The team's registration (client ID `340f7c35-1116-4e2e-af4a-0d27c36dfdd8`, owned by Sean) is already in the committed
`.env.development`, so `npm run dev` signs in with Microsoft out of the box. Run the UI on port 5173: that is the only
local redirect URI registered.

**Production (Vercel):** `.env.development` is not used by Vercel builds. In the Vercel project → Settings →
Environment Variables, add `VITE_MS_CLIENT_ID` and `VITE_MS_TENANT_ID` with the values below for the **Production**
environment only, add `https://ui-instructor.vercel.app/redirect.html` as a Single-page application redirect URI in the
app registration, then redeploy. Leave them unset for **Preview**: preview URLs change every deploy and cannot be
registered, so previews keep the development sign-in form.

For a different registration, the settings are:

```
VITE_MS_CLIENT_ID=<the Application (client) ID>
VITE_MS_TENANT_ID=1b0d02db-fc9e-4495-9537-1d379cca2ae7
VITE_ALLOWED_EMAIL_DOMAIN=calpoly.edu
VITE_MS_LOGIN_FLOW=redirect
```

Then `npm run dev` (or `npm run dev:all`) and open <http://localhost:5173>. Restart Vite after changing `.env.local`.

## 3. Test

1. Click **Sign in with Microsoft** and sign in with your @calpoly.edu account (Duo included).
2. **Works:** you land on the dashboard with your name top right. Reloading the tab keeps you signed in (redirect
   flow); **Sign out** signs you out.
3. **Fails:** either Microsoft shows an error page with an `AADSTS…` code, or you come back to the sign-in page with
   a red message and a code. Open **Sign-in details for troubleshooting** for the full message and the settings used,
   and look the code up below.
4. Also try the popup flow: set `VITE_MS_LOGIN_FLOW=popup`, restart Vite, test again. Allow pop-ups for localhost.
5. **The agent checks the sign-in too.** Once signing in works, put the same client ID in
   `assessment_agent/.env` as `AUTH_MS_CLIENT_ID=<client ID>` and restart the agent. The Student Submissions tab should
   still load (the UI sends your Microsoft ID token). To see the check refuse a request, open
   <http://localhost:8000/results> directly in the browser: it answers `401 Sign in required`.

## 4. What an error means

| Code | Meaning | Fix |
|---|---|---|
| `AADSTS50011`, `AADSTS500113` | The redirect URI is not registered (or not exactly) | Add the **Redirect URI to register** shown under the troubleshooting details, under Single-page application |
| `AADSTS9002326`, `AADSTS7000218` | The redirect URI is registered as **Web** | Move it to **Single-page application** |
| `AADSTS700016` | Cal Poly's directory does not know the app | Wrong client ID, or the app is single-tenant in another directory: make it multitenant |
| `AADSTS50194` | Single-tenant app used through a shared endpoint | Set `VITE_MS_TENANT_ID` to the directory the app is in, or make it multitenant |
| `AADSTS50020` | The account is not in the directory sign-in went to | Use Cal Poly's tenant ID above and an @calpoly.edu account |
| Consent screen, then works | First sign-in asks you to accept the app reading your basic profile | Accept. This is normal |
| `AADSTS65001` | Consent has not been given yet | Accept the consent screen if offered |
| "Need admin approval", `AADSTS90094`, `AADSTS90095` | **Cal Poly requires an administrator to approve outside apps** | Only Cal Poly ITS can fix this: ask identity-management@calpoly.edu for admin consent for the client ID |
| `AADSTS50105` | Cal Poly only allows assigned users | Cal Poly ITS assigns users or turns off "assignment required" |
| `AADSTS53003` | Blocked by a Cal Poly access policy | Cal Poly ITS |
| `timed_out` | Microsoft never handed the result back | `redirect.html` not served or the redirect URI not registered; or the popup was closed |
| `popup_window_error` | Pop-up blocked | Allow pop-ups, or use the redirect flow |
| "Only @calpoly.edu accounts can sign in" | A non-Cal Poly account was picked | Pick the @calpoly.edu account |

The codes in the last column that say *Cal Poly ITS* are the ones we cannot fix ourselves; everything else is our
configuration.

## How it was checked without a Cal Poly login

A headless Chrome script drove both flows against Cal Poly's real tenant with a placeholder client ID: the button
reaches Cal Poly's Microsoft sign-in form with the right client ID, `/redirect.html` return address, scopes and
PKCE; and a simulated Microsoft error sent back to `redirect.html` travels through the bridge and is explained on
the sign-in page with its code. The only untested step is a real account signing in, which needs the registration
above.
