---
status: ACTIVE
---
# Android data durability: Auto Backup + Google Drive

Slay keeps everything in AsyncStorage (the zustand `routiner-store` snapshot
plus the backup mirror slot) and a few native SharedPreferences. On Android
two independent layers make that survive an uninstall, WhatsApp-style:

| Layer | What it is | Needs from you |
|-------|------------|----------------|
| **Android Auto Backup** | The OS copies the app's private files to the user's Google account (≤ 25 MB, roughly daily when idle + charging + Wi-Fi) and restores them when the app is reinstalled with the same Google account. Also covers cable/Wi-Fi *device transfer* on new-phone setup. | Nothing at runtime. Rules live in `android/app/src/main/res/xml/{backup_rules,data_extraction_rules}.xml`, wired from `AndroidManifest.xml` (`allowBackup`, `fullBackupContent`, `dataExtractionRules`). |
| **Google Drive backup** | Settings → Google Drive: sign in, "Back up now", an auto-backup-on-background switch (≈ once a day), and "Restore from Google Drive". The file is the same JSON as the Export row, stored as `slay-backup.json` in the hidden Drive `appDataFolder`. A fresh install that silently signs in and finds a backup offers to restore it. | A one-time Google Cloud / Firebase setup and one constant in `src/config/google.ts` (below). Until then the Settings group shows a single "set up" row and nothing loads the sign-in module. |

## 1. Auto Backup — what is covered

Only the paths listed in the XML rules are backed up (once any `<include>`
exists the platform backs up nothing else). They name every durable file:

- `databases/AsyncStorage` + `-wal`, `-shm`, `-journal` — the Room database
  behind the default `@react-native-async-storage/async-storage` export
  (v3.1.1; `LegacyStorageSupplier.kt`, `DATABASE_NAME = "AsyncStorage"`). The
  WAL/shm sidecars must travel with the main file or un-checkpointed writes
  are lost on restore.
- `databases/RKStorage` (+ `-journal`) — the pre-Room AsyncStorage file; the
  library migrates it into `AsyncStorage` on first open if present.
- `databases/async-storage/` — where AsyncStorage v3 *named* stores
  (`createAsyncStorage('name')`) put `<name>.sqlite`; unused today, included so
  a later switch needs no rules change.
- `shared_prefs/*` — the native `slay_*` prefs (Zen DND, App Lock, widget
  payload) and Google Sign-In's cached account (`com.google.android.gms.signin`),
  which is what lets Drive auto-backup resume after a reinstall. The rules have
  no glob syntax, so the whole domain is included and the one non-durable file
  (`com.lucidbots.lucidapp.adhoc_preferences.xml`, RN's debug dev-menu prefs) is
  excluded.

`cache/`, `code_cache/` and `no_backup/` are never backed up by the platform,
and the `files/` domain is deliberately not included: it only ever holds the RN
dev bundle and Hermes/Metro scratch files.

### Testing Auto Backup on the emulator

The emulator has no Google transport by default, so use the local one. The
`bmgr` commands need the app installed and, for `restore`, not running.

```sh
adb shell bmgr enable true
adb shell bmgr list transports
#   android/com.android.internal.backup.LocalTransport      ← pick this one
# * com.google.android.gms/.backup.BackupTransportService   ← on a Play device
adb shell bmgr transport android/com.android.internal.backup.LocalTransport

# 1. use the app (create habits), then force a backup pass
adb shell bmgr backupnow com.lucidbots.lucidapp.adhoc
#   → "Package com.lucidbots.lucidapp.adhoc with result: Success"
adb shell bmgr list sets          # note the token of the newest set

# 2. wipe and reinstall
adb uninstall com.lucidbots.lucidapp.adhoc
pnpm android                       # or: adb install <apk>

# 3. restore that set into the new install (kills the app first)
adb shell bmgr restore <token> com.lucidbots.lucidapp.adhoc
#   → "restoreFinished: 0" ; relaunch — habits are back
```

Useful while debugging: `adb logcat -s BackupManagerService BackupXmlParserLogging`
(shows which include/exclude matched what) and `adb shell dumpsys backup`.
`bmgr backupnow` performs the full-data backup for this app immediately, so
there is no need to wait for the idle-maintenance window.

### On a real device

Settings → Google → Backup must be on (it is by default) and the device needs
a Google account. Backups run about once a day when the phone is idle,
charging and on Wi-Fi (unmetered); a fresh pass can be forced with the same
`adb shell bmgr backupnow com.lucidbots.lucidapp.adhoc` even with the Google
transport selected. When the app is installed again (Play Store or `adb
install`) on a device signed into the same Google account, the OS restores the
backup set before the app's first launch — no UI, no sign-in. The whole set
must stay under 25 MB; Slay's database is a few hundred KB. Device-to-device
transfer during new-phone setup uses the `<device-transfer>` rules and has no
size limit.

## 2. Google Drive backup — one-time setup

The app uses `@react-native-google-signin/google-signin` **16.1.5** (the free
"original" API: `GoogleSignin.configure / hasPlayServices / signIn /
signInSilently / getTokens / signOut / getCurrentUser`) with the scope
`https://www.googleapis.com/auth/drive.appdata`, and talks to the Drive REST
v3 API directly with the access token from `getTokens()`. The Firebase project
**slay-d7d4f** already exists (project number 516646659613; the iOS app is
registered). Its `GoogleService-Info.plist` has no `CLIENT_ID`, which means the
Google sign-in provider has not been enabled yet — step 3 creates the OAuth
clients.

1. **Register the Android app.** Firebase console → project `slay-d7d4f` →
   Project settings → *Add app* → Android:
   - Package name: `com.lucidbots.lucidapp.adhoc`
   - Debug signing certificate SHA-1 (from
     `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`):

     ```
     5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
     ```

     (SHA-256 for reference:
     `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`.)
     The release build currently signs with the same debug keystore
     (`android/app/build.gradle`), so one fingerprint covers both; add the
     release / Play App Signing SHA-1 here too the day that changes.
   - Download `google-services.json` at the end of the wizard (you only need to
     read one value out of it, see step 4).
2. **Enable the Google provider.** Firebase console → Authentication →
   *Sign-in method* → Google → Enable → Save. This creates the OAuth 2.0
   clients in the underlying Google Cloud project: a *Web client* and an
   *Android client* bound to the package + SHA-1 from step 1.
3. **Copy the Web client ID.** Open the downloaded `google-services.json` and
   take the `client_id` whose `client_type` is `3` (or Google Cloud Console →
   APIs & Services → Credentials → "Web client (auto created by Google
   Service)"). It ends in `.apps.googleusercontent.com`. Paste it into
   `src/config/google.ts`:

   ```ts
   export const GOOGLE_WEB_CLIENT_ID = '5166…-xxxx.apps.googleusercontent.com';
   ```

   Only the Web client ID is used by the code (it is what `requestIdToken`
   needs); the Android client is matched implicitly through the package name
   and SHA-1. A wrong or missing Android client is the classic
   `DEVELOPER_ERROR` (status code 10) on `signIn()`.
4. **Enable the Google Drive API.** Google Cloud Console → select project
   `slay-d7d4f` → APIs & Services → Library → *Google Drive API* → Enable.
   Without it every request fails with `403: Google Drive API has not been used
   in project … before or it is disabled`.
5. **OAuth consent screen test user.** Google Cloud Console → APIs & Services →
   OAuth consent screen (Google Auth Platform → Audience). While the app is in
   *Testing*, add the Gmail account you'll sign in with under *Test users* —
   otherwise sign-in ends with `access_denied` / "app hasn't been verified".
   `drive.appdata` is a non-sensitive scope, so no verification is needed for
   personal use.
6. Rebuild (`pnpm android`). Settings → Google Drive → *Sign in with Google*,
   then *Back up now*. The file is invisible in Drive's UI (app-data folder);
   Drive → Settings → *Manage apps* lists "Slay" with its storage use.

### Is `google-services.json` required?

**No — not for this library on Android.** v16 reads nothing from it: the
package's Android module (`RNGoogleSigninModule.java`) builds
`GoogleSignInOptions` from the `webClientId` / `scopes` passed to
`GoogleSignin.configure()` in JS, and the project does not apply the
`com.google.gms.google-services` Gradle plugin (`android/build.gradle` and
`android/app/build.gradle` have no Firebase/Google-services entries). The
library's own Expo config plugin only wires the file in for Expo projects. So:
keep the downloaded file out of the repo (it is only the source of the Web
client ID). If Firebase products are added later (Analytics, Messaging), place
it at `android/app/google-services.json` and apply the plugin then — it will
be inert until that happens.

### Where things live at runtime

- Drive file: `slay-backup.json` in the account's hidden `appDataFolder`,
  created once (`POST /upload/drive/v3/files?uploadType=multipart`) and then
  updated in place (`PATCH /upload/drive/v3/files/{id}?uploadType=media`).
- Local bookkeeping (own AsyncStorage keys, never part of the store or of
  exports): `driveBackup:meta` `{lastBackupAt, bytes, account}`,
  `driveBackup:auto` (`'true'`/`'false'`, default on), and
  `driveBackup:promptedRestore` (the first-launch restore offer, once per
  install).
- Auto-backup: `maybeAutoDriveBackup()` runs when the app goes to the
  background; it uploads only when signed in on this install, the switch is on,
  and the last upload is 20 h+ old, and it swallows errors.
- Restore: validate → "Replace your data?" → replace, exactly like the iOS
  paste import, with a pre-import snapshot kept under
  `routiner-preimport-snapshot`.

### Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `DEVELOPER_ERROR` / status 10 on sign-in | Package name or SHA-1 in Firebase doesn't match this build, or the ID in `src/config/google.ts` is not the *Web* client. Re-check step 1 and 3; make sure the build is signed with `android/app/debug.keystore`. |
| Sign-in shows "Access blocked: app hasn't been verified" / `access_denied` | The account isn't a test user on the consent screen (step 5). |
| `Google Drive error 403: … API has not been used …` | Drive API not enabled (step 4). |
| `Google Drive error 403: Insufficient Permission` | The account granted sign-in before the `drive.appdata` scope existed. Sign out in Settings, revoke Slay at <https://myaccount.google.com/permissions>, sign in again. |
| Repeated 401 | The app refreshes once per request; a persistent 401 means the grant was revoked — sign in again. |
| Play Services missing (emulator without Google APIs) | Use a *Google APIs* / *Google Play* system image; the app shows an Alert instead of crashing. |
