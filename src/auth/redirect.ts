// The sign-in return page (redirect.html). MSAL v5 requires this: it hands Microsoft's response to the
// app that started the sign-in (the popup's opener, or the page that redirected), then closes or
// navigates back. MSAL's docs say the page must run nothing but the bridge.
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

broadcastResponseToMainFrame().catch((error: unknown) => {
  document.body.textContent = `Sign-in could not be completed: ${error instanceof Error ? error.message : String(error)}`;
});
