import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("logout clears XChat browser data before ending the WorkOS session", () => {
  const logoutPage = read("app/logout/page.tsx");
  const logout = read("shared/lib/auth/logout.ts");
  const logoutCore = read("shared/lib/auth/logoutCore.ts");
  const logoutRoute = read("app/logout/complete/route.ts");
  const proxy = read("proxy.ts");

  assert.match(logoutPage, /void logout\(\)/);
  assert.doesNotMatch(logoutPage, /<main|Logging out/);
  assert.match(logout, /await clearXChatBrowserData\(\)/);
  assert.ok(
    logoutCore.indexOf("await dependencies.clearBrowserData()") <
      logoutCore.indexOf("dependencies.submitLogout()")
  );
  assert.match(logout, /\/logout\/complete/);
  assert.match(logout, /form.method = "post"/);
  assert.match(logout, /submitDocumentFormIntentionally\(form\)/);
  assert.match(logoutRoute, /export const POST/);
  assert.doesNotMatch(logoutRoute, /export const GET/);
  assert.match(
    logoutRoute,
    /await signOut\(\{ returnTo: new URL\("\/", siteUrl\)\.toString\(\) \}\)/
  );
  assert.doesNotMatch(logoutRoute, /redirect\("\/"\)/);
  assert.match(proxy, /\^\\\/logout\(\?:\\\/complete\)\?\$/);
});

test("both account menus start logout without navigating to the logout page", () => {
  const header = read("features/webapp/ui/components/Header.tsx");
  const landingLink = read(
    "features/landing/ui/components/LandingAuthLink.tsx"
  );
  assert.match(header, /onSelect=\{\(\) => \{\s*void logout\(\)/);
  assert.doesNotMatch(header, /router.push\("\/logout"\)/);
  assert.match(landingLink, /href.split\("\?"\)\[0\] === "\/logout"/);
  assert.match(landingLink, /void logout\(\);\s*return;/);
  assert.match(landingLink, /navigateDocumentIntentionally\(href\)/);
});

test("clearing XChat browser data removes memory, PINs, and the device key", () => {
  const browserSession = read("features/agent/lib/xChatBrowserSession.ts");
  const credentialStorage = read(
    "features/agent/lib/xChatDeviceCredentialStorage.ts"
  );

  assert.match(
    browserSession,
    /clearXChatBrowserData[\s\S]*?lockXChatInBrowser\(\);[\s\S]*?await forgetAllRememberedXChatPins\(\)/
  );
  assert.match(
    credentialStorage,
    /transaction\.objectStore\(DEVICE_KEYS_STORE\)\.clear\(\)/
  );
  assert.match(
    credentialStorage,
    /transaction\.objectStore\(CREDENTIALS_STORE\)\.clear\(\)/
  );
  assert.doesNotMatch(credentialStorage, /deleteDatabase/);
});

test("X account replacement and disconnect clear XChat browser data", () => {
  const connection = read(
    "features/linked-accounts/hooks/useXAccountConnection.ts"
  );

  assert.equal(connection.match(/await clearXChatBrowserData\(\)/g)?.length, 2);
  assert.equal(connection.match(/catch \(cleanupError\)/g)?.length, 2);
  assert.match(
    connection,
    /connectedAccountIdRef\.current !== nextStatus\.connectedAccountId[\s\S]*?await clearXChatBrowserData\(\)[\s\S]*?Failed to clear XChat browser data after X account change:[\s\S]*?setXStatus\(nextStatus\)/
  );
  assert.match(
    connection,
    /await disconnectTwitter\(\{\}\);[\s\S]*?await clearXChatBrowserData\(\)[\s\S]*?Failed to clear XChat browser data after X account disconnect:[\s\S]*?toast\.success\("Disconnected X\/Twitter account"\)/
  );
});

test("invalid remembered PINs are removed automatically", () => {
  const browserSession = read("features/agent/lib/xChatBrowserSession.ts");

  assert.match(
    browserSession,
    /failure\.kind === "invalid_pin"[\s\S]*?await forgetRememberedXChatPin\(target\)/
  );
});
