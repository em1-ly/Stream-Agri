# Alternative Ways to View PowerSync Logs

## Method 1: Expo Start (Recommended)

```bash
cd /Users/curveridsupport/Stream-Agri
npx expo start
```

Then:
- Press `i` for iOS
- Logs will appear in the terminal
- Look for PowerSync messages

## Method 2: Console.app with Broader Filters

1. Open Console.app
2. Select your iPhone
3. Try these filters (one at a time):

**Filter 1: Just app name**
```
TobaccoLogistics
```

**Filter 2: React Native**
```
ReactNativeJS
```

**Filter 3: All logs (no filter)**
- Just clear the filter box
- Scroll through to find PowerSync messages

## Method 3: Check Login Screen Status

On your iPhone login screen:
- What percentage is shown?
- What status text appears?
- Is it stuck? At what percentage?

## Method 4: Device Console (Command Line)

```bash
xcrun devicectl device monitor logs --device F6F6FF40-C167-538A-B91E-3DF2EB56C291 | grep -i "PowerSync\|sync\|🔄\|📊"
```

## What PowerSync Logs Look Like

You should see messages like:
- `Setting up PowerSync`
- `🔄 PowerSync status during initial sync:`
- `📊 Progress: X%`
- `Downloading data... X%`
- `✅ PowerSync connected and synced`
- `Error` or `Failed` (if there are issues)
