# View Logs Without Android Studio

## Method 1: React Native CLI (Easiest)

### Android Logs:
```bash
npx react-native log-android
```

### iOS Logs (Simulator):
```bash
npx react-native log-ios
```

## Method 2: Using ADB directly (if Android SDK is installed)

### View all Android logs:
```bash
adb logcat
```

### Filter for your app only:
```bash
adb logcat | grep -i "ReactNative\|Expo\|TobaccoLogistics"
```

### Clear logs and start fresh:
```bash
adb logcat -c && adb logcat
```

## Method 3: Using Expo Start (shows logs in terminal)

```bash
npx expo start
```
Then press:
- `a` for Android
- `i` for iOS
- Logs will appear in the terminal

## Method 4: iOS Simulator Logs

### View simulator logs:
```bash
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "TobaccoLogistics"'
```

### Or view all simulator logs:
```bash
xcrun simctl spawn booted log stream
```

## Method 5: Device Console (macOS)

For iOS physical devices:
1. Open **Console.app** (built into macOS)
2. Select your device from the left sidebar
3. Filter by your app name

## Quick Commands:

```bash
# Android - filtered logs
npx react-native log-android | grep -i "error\|warn\|log"

# iOS - filtered logs  
npx react-native log-ios | grep -i "error\|warn\|log"

# Both platforms (if expo start is running)
npx expo start
```
