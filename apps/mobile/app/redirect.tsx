import * as WebBrowser from 'expo-web-browser';

// This page handles the OAuth redirect URI (depomobile://redirect).
// expo-auth-session requires a matching route that calls maybeCompleteAuthSession()
// so the auth session is properly closed and the token returned to the caller.
WebBrowser.maybeCompleteAuthSession();

export default function Redirect() {
  return null;
}
