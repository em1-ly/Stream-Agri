# How to View PowerSync Logs in Console.app

## Quick Filter Strings for Console.app:

### Method 1: Simple PowerSync Filter
In the Console.app search box, type:
```
PowerSync
```
or
```
powersync
```

### Method 2: Filter by PowerSync Status/Connection
```
PowerSync status
```
or
```
PowerSync connected
```

### Method 3: Filter by Upload/Sync Operations
```
uploadData
```
or
```
unified_create
```

### Method 4: Filter by Emoji Patterns (PowerSync uses these)
```
🔄
```
or
```
📤
```
or
```
⚠️
```

### Method 5: Combined Filter (PowerSync + Errors)
```
PowerSync error
```

### Method 6: Filter by Specific PowerSync Operations
```
PowerSync (uploadData OR fetchCredentials OR statusChanged)
```

## Advanced Filtering Options:

### Filter by Subsystem (if PowerSync uses one):
```
subsystem:PowerSync
```

### Filter by Process and PowerSync:
```
process:TobaccoLogistics PowerSync
```

### Filter PowerSync Upload Operations:
```
PowerSync uploadData
```

### Filter PowerSync Connection Status:
```
PowerSync (connected OR disconnected OR connecting)
```

## Command Line Alternative:

### For iOS Device:
```bash
xcrun devicectl device monitor logs --device <device-id> | grep -i "powersync\|PowerSync\|uploadData\|unified_create"
```

### For Android (if device connected):
```bash
adb logcat | grep -i "powersync\|PowerSync\|uploadData\|unified_create"
```

## What PowerSync Logs Look Like:

Based on your code, PowerSync logs include:
- `🔄 uploadData method started...`
- `📤 Sending to unified_create`
- `PowerSync status on Login Screen:`
- `Setting up PowerSync`
- `Returning credentials to PowerSync:`
- `⚠️` warnings for sync errors

## Recommended Filter:

For the most comprehensive PowerSync logs, use:
```
PowerSync OR uploadData OR unified_create OR 🔄 OR 📤
```

This will catch:
- All PowerSync-related messages
- Upload operations
- API calls
- Status changes
- Emoji-prefixed logs
