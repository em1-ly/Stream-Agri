# View PowerSync Logs on iOS - Quick Guide

## Method 1: Console.app (Easiest - Built into macOS)

1. **Connect your iPhone via USB**
2. **Open Console.app**:
   - Press `Cmd + Space` (Spotlight)
   - Type "Console" and press Enter
3. **Select your device** in the left sidebar (Emily's iPhone)
4. **In the search box, type**:
   ```
   TobaccoLogistics PowerSync|uploadData|unified_create
   ```
   Or more comprehensive:
   ```
   TobaccoLogistics (PowerSync|powersync|uploadData|unified_create|🔄|📤|⚠️)
   ```

## Method 2: Command Line (Real-time streaming)

### Stream all PowerSync logs:
```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep -i "PowerSync\|uploadData\|unified_create"
```

### Stream with app filter:
```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep -i "TobaccoLogistics.*PowerSync\|TobaccoLogistics.*uploadData"
```

## Method 3: Save logs to file

```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 > ios-logs.txt
# Then search in the file
grep -i "PowerSync\|uploadData\|unified_create" ios-logs.txt
```

## Method 4: React Native CLI

If your app is running via Expo/React Native:
```bash
npx react-native log-ios | grep -i "PowerSync\|uploadData"
```

## What to Look For

**PowerSync sync issues might show:**
- `PowerSync status` - connection status
- `uploadData method started` - upload beginning
- `Sending to unified_create` - API calls
- `Error` or `Failed` - sync failures
- `⚠️` - warnings
- Connection timeouts
- Authentication errors

## Quick Commands

**View all app logs (then filter manually):**
```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep "TobaccoLogistics"
```

**View errors only:**
```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep -i "TobaccoLogistics.*error\|PowerSync.*error"
```

**View sync status:**
```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep -i "PowerSync.*status\|PowerSync.*connect"
```
