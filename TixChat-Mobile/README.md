# TixChat Mobile

Realtime chat application mobile app built with Expo and React Native.

## Tech Stack

- **Framework**: Expo 54 / React Native 0.81
- **Navigation**: React Navigation v7
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **Storage**: AsyncStorage
- **Build**: EAS Build
- **Deployment**: App Store, Google Play, Web

## Getting Started

```bash
npm install
npx expo start
```

### Android Dev Connection

When using an Android device/emulator connected through ADB, keep the local
backend URLs as `127.0.0.1` and forward the backend port before opening the app:

```bash
npm run android:reverse
```

This forwards both Metro (`8081`) and the backend (`5000`) to the Android
runtime.

Call audio uses the Amazon Chime SDK native media client, which is packaged for
ARM Android ABIs. Use a physical Android device or an emulator/runtime with ARM
translation support; x86/x86_64-only emulators cannot run the Chime audio native
library.

### Environment Variables

Copy `.env.example` to `.env` (or set via `expo env`):

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000/api
EXPO_PUBLIC_SOCKET_URL=http://127.0.0.1:5000
```

## Building

### Local Development Build

```bash
# iOS Simulator
eas build --profile development --platform ios --local

# Android APK
eas build --profile development --platform android --local
```

### Local Android Gradle Build

This repo includes PowerShell helpers that keep Android builds on JDK 17 without
changing the machine-wide default Java:

```powershell
.\scripts\android-assemble-debug.ps1
```

The script expects:

- JDK 17 at `C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot`
- Android SDK at `%LOCALAPPDATA%\Android\Sdk`
- `android/local.properties` pointing to that SDK path

`android/local.properties` is local machine config and is ignored by git.

### EAS Build (Cloud)

```bash
# Configure EAS
eas login
eas build:configure

# Build for production
eas build --profile production --platform ios
eas build --profile production --platform android
```

### EAS Submit

```bash
# Submit to App Store
eas submit --platform ios --latest

# Submit to Google Play
eas submit --platform android --latest
```

## Web Deployment

```bash
npx expo export --platform web
# Deploy the 'dist' folder to any static hosting
```

## Features

- Real-time messaging with Socket.IO
- User authentication (JWT)
- One-on-one and group conversations
- File attachments (camera + gallery)
- Friend system
- User presence
- Message reactions
- Cross-platform: iOS, Android, Web

## License

MIT
