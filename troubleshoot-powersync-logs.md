# Troubleshooting: PowerSync Logs Not Showing in Console.app

## Issue: Console.app not showing PowerSync logs

### Solution 1: Use Broader Filters in Console.app

Try these filters (from broadest to most specific):

**1. All app logs:**
```
TobaccoLogistics
```

**2. All React Native logs:**
```
ReactNativeJS
```

**3. All console logs:**
```
console
```

**4. PowerSync specific (if above work):**
```
🔄|📤|⚠️|uploadData|PowerSync
```

### Solution 2: Check SyncLogs Screen in App

PowerSync errors/warnings are stored in the `system_logs` table:

1. **Open your app**
2. **Go to: Settings → Sync Logs**
3. **This shows all PowerSync sync errors and warnings**

This is often MORE useful than Console.app because it shows:
- What records failed to sync
- Error messages
- Retry counts
- Table names and record IDs

### Solution 3: Use React Native Logs

```bash
npx react-native log-ios
```

This shows all React Native console logs including PowerSync.

### Solution 4: Check if App is Running

1. Make sure your app is **actively running** on the iPhone
2. Console.app only shows logs when the app is running
3. Try interacting with the app (trigger a sync) while watching Console.app

### Solution 5: Check Console.app Settings

1. In Console.app, make sure:
   - Your device is selected in left sidebar
   - "Include Info Messages" is enabled (bottom toolbar)
   - Log level is set to "All" or "Info"
   - No time filter is set

### Solution 6: Check PowerSync Status Directly

In your app, check:
- **WiFi icon** (green = connected, red = disconnected)
- **Settings → Sync Logs** (shows errors)
- **Login screen** (shows sync progress)

## Most Likely Solution

**Use the SyncLogs screen in your app** - it's more reliable than Console.app for PowerSync issues because:
- Shows actual sync errors
- Shows which records failed
- Shows retry counts
- Doesn't require Console.app setup

Go to: **Settings → Sync Logs** in your app to see what's failing.
