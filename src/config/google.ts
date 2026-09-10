/**
 * Google Sign-In configuration (Android Google Drive backup).
 *
 * Paste the Firebase project's "Web client" OAuth 2.0 client ID here — the
 * entry with client_type 3 in google-services.json, or Google Cloud Console
 * → APIs & Services → Credentials → "Web client (auto created by Google
 * Service)". Step-by-step: docs/android-google-drive-setup.md.
 *
 * Empty means Drive backup is off: the Settings group explains how to set it
 * up and nothing ever loads the native sign-in module.
 */
export const GOOGLE_WEB_CLIENT_ID = '';
