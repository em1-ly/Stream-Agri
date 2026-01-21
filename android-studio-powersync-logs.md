# View PowerSync Logs in Android Studio

## Step 1: Open Logcat

1. Open **Android Studio**
2. At the bottom of the screen, click the **Logcat** tab
3. If you don't see it: **View** → **Tool Windows** → **Logcat**

## Step 2: Connect Your Android Device

1. Connect your Android device via USB
2. Enable **USB debugging** on your device:
   - Settings → About phone → Tap "Build number" 7 times
   - Settings → Developer options → Enable "USB debugging"
3. In Logcat, select your device from the device dropdown (top toolbar)

## Step 3: Filter for PowerSync Logs

### Method 1: Simple Filter (Recommended)

In the Logcat search box, type:
```
PowerSync|powersync|uploadData|unified_create
```

### Method 2: Package Name Filter

```
package:com.emilymarimo.tobaccologistics PowerSync
```

### Method 3: Tag Filter

If PowerSync uses specific tags:
```
PowerSync:* OR ReactNativeJS:* PowerSync
```

### Method 4: Combined Filter (Most Comprehensive)

```
package:com.emilymarimo.tobaccologistics (PowerSync|powersync|uploadData|unified_create|🔄|📤|⚠️)
```

## Step 4: Filter by Log Level

Use the dropdown next to the search box:
- **Verbose**: All logs
- **Debug**: Debug and above
- **Info**: Info and above
- **Warn**: Warnings and errors
- **Error**: Errors only (most useful for debugging)

## Step 5: Save Filter (Optional)

1. Click the **+** icon next to the filter dropdown
2. Name it: "PowerSync"
3. Set your filter string
4. Click **OK**
5. Now you can quickly select "PowerSync" from the filter dropdown

## Quick Filter Strings

**All PowerSync activity:**
```
PowerSync|uploadData|unified_create
```

**PowerSync errors only:**
```
PowerSync error
```

**PowerSync upload operations:**
```
uploadData|unified_create
```

**PowerSync with emoji logs:**
```
🔄|📤|⚠️|PowerSync
```

## What PowerSync Logs Look Like

Based on your code, you'll see logs like:
- `🔄 uploadData method started...`
- `📤 Sending to unified_create`
- `PowerSync status on Login Screen:`
- `Setting up PowerSync`
- `Returning credentials to PowerSync:`
- `⚠️` warnings for sync errors

## Troubleshooting

### No Logs Appearing?
1. Make sure your app is running on the device
2. Check device is selected in Logcat dropdown
3. Clear logs: Click the trash icon, then start fresh
4. Make sure filter isn't too restrictive

### Too Many Logs?
1. Add package filter: `package:com.emilymarimo.tobaccologistics`
2. Filter by log level: Select "Error" or "Warn"
3. Combine filters: `package:com.emilymarimo.tobaccologistics PowerSync error`

### Device Not Showing?
1. Check USB debugging is enabled
2. Try different USB cable/port
3. Restart ADB: **Tools** → **SDK Manager** → **SDK Tools** → Check "Android SDK Platform-Tools"

## Pro Tips

1. **Save multiple filters**: Create separate filters for "PowerSync All", "PowerSync Errors", "PowerSync Upload"
2. **Use regex**: Enable regex mode for advanced filtering
3. **Export logs**: Right-click in Logcat → **Save Logcat to File**
4. **Color coding**: Logcat automatically colors errors (red) and warnings (yellow)
5. **Search within logs**: Use Cmd+F (Mac) or Ctrl+F (Windows) to search within filtered logs

## Example Filter Setup

**Filter Name**: "PowerSync All"
**Filter String**: `package:com.emilymarimo.tobaccologistics (PowerSync|powersync|uploadData|unified_create)`
**Log Level**: Verbose

**Filter Name**: "PowerSync Errors"
**Filter String**: `package:com.emilymarimo.tobaccologistics PowerSync error`
**Log Level**: Error
