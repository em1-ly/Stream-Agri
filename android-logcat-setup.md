# Android Logcat Setup Guide

## Method 1: Using Android Studio (GUI)

### Step 1: Enable Developer Options on Your Android Device
1. Go to **Settings** → **About phone**
2. Tap **Build number** 7 times until you see "You are now a developer!"
3. Go back to **Settings** → **Developer options**
4. Enable **USB debugging**

### Step 2: Connect Device
1. Connect your Android device to your Mac via USB cable
2. On your device, when prompted, tap **Allow USB debugging** and check "Always allow from this computer"

### Step 3: Open Logcat in Android Studio
1. Open **Android Studio**
2. At the bottom of the screen, click the **Logcat** tab
3. If you don't see it, go to **View** → **Tool Windows** → **Logcat**

### Step 4: Select Your Device
1. In the top toolbar of Logcat, you'll see a device dropdown
2. Select your connected Android device

### Step 5: Filter Logs
In the Logcat search box, you can filter by:

**For your app:**
```
TobaccoLogistics
```

**For PowerSync:**
```
PowerSync OR powersync OR uploadData OR unified_create
```

**For React Native:**
```
ReactNative
```

**For Expo:**
```
Expo
```

**Combined filter (recommended):**
```
TobaccoLogistics|PowerSync|ReactNative|Expo
```

### Step 6: Filter by Log Level
Use the dropdown next to the search box to filter by:
- **Verbose** (all logs)
- **Debug**
- **Info**
- **Warn**
- **Error** (most useful for debugging)

## Method 2: Using Command Line (Faster & Easier)

### Step 1: Install Android SDK Platform Tools
If you don't have `adb` installed:

**Option A: Via Android Studio**
1. Android Studio → **Tools** → **SDK Manager**
2. Go to **SDK Tools** tab
3. Check **Android SDK Platform-Tools**
4. Click **Apply** to install

**Option B: Via Homebrew (Mac)**
```bash
brew install android-platform-tools
```

### Step 2: Verify ADB is Installed
```bash
adb version
```

### Step 3: Connect Device
1. Connect your Android device via USB
2. Enable USB debugging (see Method 1, Step 1)
3. Verify connection:
```bash
adb devices
```
You should see your device listed.

### Step 4: View Logs

**All logs:**
```bash
adb logcat
```

**Filter for your app only:**
```bash
adb logcat | grep -i "TobaccoLogistics"
```

**Filter for PowerSync:**
```bash
adb logcat | grep -i "PowerSync\|powersync\|uploadData\|unified_create"
```

**Filter for errors only:**
```bash
adb logcat *:E
```

**Filter for your app + errors:**
```bash
adb logcat | grep -i "TobaccoLogistics" | grep -i "error"
```

**Clear logs and start fresh:**
```bash
adb logcat -c && adb logcat
```

## Method 3: Advanced Logcat Filters

### Filter by Package Name
```bash
adb logcat | grep "com.emilymarimo.tobaccologistics"
```

### Filter by Process ID
```bash
# First, get your app's PID
adb shell pidof com.emilymarimo.tobaccologistics

# Then filter by PID (replace 12345 with actual PID)
adb logcat | grep "12345"
```

### Filter by Tag
```bash
# React Native logs
adb logcat ReactNativeJS:*

# PowerSync logs (if it uses a tag)
adb logcat PowerSync:*
```

### Save Logs to File
```bash
adb logcat > logs.txt
```

### Filter and Save
```bash
adb logcat | grep -i "TobaccoLogistics\|PowerSync" > app-logs.txt
```

## Quick Reference Commands

```bash
# Check if device is connected
adb devices

# View all logs
adb logcat

# View logs for your app
adb logcat | grep -i "TobaccoLogistics"

# View PowerSync logs
adb logcat | grep -i "PowerSync\|uploadData\|unified_create"

# View errors only
adb logcat *:E

# Clear logs
adb logcat -c

# View logs with timestamps
adb logcat -v time

# View logs with process names
adb logcat -v process
```

## Troubleshooting

### Device Not Showing Up
1. Make sure USB debugging is enabled
2. Try different USB cable
3. Try different USB port
4. Restart adb:
```bash
adb kill-server
adb start-server
adb devices
```

### No Logs Appearing
1. Make sure your app is running on the device
2. Try clearing logs first: `adb logcat -c`
3. Check if device is connected: `adb devices`

### Permission Denied
```bash
# On Mac, you might need to allow terminal access
# System Preferences → Security & Privacy → Privacy → Full Disk Access
# Add Terminal or iTerm
```
