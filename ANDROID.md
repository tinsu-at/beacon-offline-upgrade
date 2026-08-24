# Beacon — Private Android App (Capacitor)

Beacon is now wrapped as a real Android app for personal use. Nothing about the
web/PWA version changed: the same Beacon, same UI, same Gemini AI, memory,
tasks, habits, journal, goals, Telegram, voice and offline cache.

## How it works

Beacon has a server side (TanStack Start server functions, the chat API, the
Telegram webhook), so the Android shell loads the deployed Beacon build instead
of a static export. This keeps 100% feature parity between web and Android.

The URL lives in `capacitor.config.ts` → `server.url`
(currently `https://tinsae-beacon-light.lovable.app`). Publish the app once, then
that URL is what the phone loads. To test against the preview build instead,
change the URL and re-run `npx cap sync android`.

Native additions (all no-ops in the browser):

- `@capacitor/local-notifications` — reminders fire even when the app is closed
- `@capacitor/status-bar` — status bar matches the Beacon theme
- `@capacitor/splash-screen` — branded splash, hidden once the app boots
- `@capacitor/app` — Android hardware back button closes dialogs, then navigates
- `@capacitor/haptics`, `@capacitor/preferences`

Permissions declared: `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`,
`MODIFY_AUDIO_SETTINGS`, `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`,
`SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`,
`FOREGROUND_SERVICE`.

App id `app.lovable.beacon`, app name **Beacon**, min SDK 30 (Android 11 —
Samsung A10 with Android 11+ is supported), target SDK 36.

## Build the APK (on your computer)

The APK can't be compiled inside Lovable — it needs the Android SDK and Java.
Do this once locally:

1. Install **Android Studio** (includes the Android SDK) and **JDK 21**.
2. Export this project to GitHub from Lovable, then clone it and run:

   ```bash
   bun install          # or: npm install
   npx cap sync android
   ```

3. Create a signing key (once):

   ```bash
   keytool -genkey -v -keystore beacon.keystore -alias beacon \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   Move `beacon.keystore` into the `android/` folder, then create
   `android/keystore.properties`:

   ```properties
   storeFile=beacon.keystore
   storePassword=YOUR_PASSWORD
   keyAlias=beacon
   keyPassword=YOUR_PASSWORD
   ```

   This file is git-ignored — never commit it.

4. Build the signed release APK:

   ```bash
   cd android
   ./gradlew assembleRelease
   ```

   Output: `android/app/build/outputs/apk/release/app-release.apk`

## Install on your phone

1. Copy the APK to the phone (USB, Drive, Telegram-to-self, whatever).
2. On the phone, allow **Install unknown apps** for the file manager you use.
3. Tap the APK and install. Beacon appears in the launcher with its own icon.

Alternatively, with the phone plugged in and USB debugging on:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Notes

- No Play Store, no Google services, no analytics — private build only.
- Grant **microphone** and **notifications** on first use for voice and reminders.
- After changing `capacitor.config.ts`, icons, or permissions, re-run
  `npx cap sync android` before rebuilding.
- Changing Beacon itself (pages, AI, features) needs no rebuild — publish from
  Lovable and the app picks it up on next launch.
