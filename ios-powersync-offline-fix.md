# PowerSync Offline After iOS Upgrade - Troubleshooting Guide

## Problem
After upgrading iPads to iOS 18.2 (or newer), PowerSync shows as **offline** and data is not syncing.

## Quick Fixes (Try in Order)

### 1. **Reconnect PowerSync from Settings**
- Open the app → Go to **Settings**
- Look for the **PowerSync: Offline** status box
- Tap the **"Reconnect"** button
- Wait 3-5 seconds
- If it still shows offline, continue to step 2

### 2. **Enable Background App Refresh** (Most Common Fix)
iOS upgrades often reset app permissions. This is the #1 cause:

1. Open **iOS Settings** app on the iPad
2. Scroll down to **Tobacco Logistics**
3. Tap on it
4. Find **"Background App Refresh"**
5. Make sure it's **ON** (green)
6. Go back to the app and try **Reconnect** again

### 3. **Check Internet Connection**
- Make sure the iPad has Wi-Fi or cellular data
- Try opening Safari and visiting a website
- If no internet, PowerSync cannot connect

### 4. **Re-login to the App**
Sometimes credentials get corrupted after OS upgrades:

1. In the app, go to **Settings** → **Logout**
2. Close the app completely (swipe it away)
3. Reopen the app
4. Log back in with your credentials
5. Wait for the initial sync to complete
6. Check Settings → PowerSync status

### 5. **Force Close and Reopen**
1. Swipe up from bottom (or double-tap home button)
2. Swipe the **Tobacco Logistics** app away to close it
3. Wait 5 seconds
4. Reopen the app
5. Check Settings → PowerSync status

### 6. **Check Server Configuration**
If still offline, verify the server settings are correct:

1. Go to **Admin Login** screen
2. Check that:
   - Server IP/URL is correct
   - Database name is correct
   - PowerSync URI is correct
3. If any are wrong, update them and re-login

### 7. **Last Resort: Clear Data & Resync**
⚠️ **Warning**: This will delete all local data. Only do this if nothing else works.

1. Go to **Admin Login** screen
2. Tap **"Clear Data & Resync"**
3. Confirm the action
4. Re-login and wait for initial sync

## What Changed in the App

We've added:
- **PowerSync Connection Status** indicator in Settings (shows Connected/Offline)
- **Reconnect Button** to manually trigger reconnection
- Better error messages when connection fails

## Still Not Working?

If PowerSync is still offline after trying all steps above:

1. **Check Sync Logs** in Settings:
   - Look for any error messages
   - Note the error details (table name, record ID, error message)
   - Share these with support

2. **Check Console Logs** (if you have access):
   - Look for PowerSync connection errors
   - Look for network errors
   - Look for SSL/certificate errors

3. **Verify Server is Running**:
   - Make sure the backend server is accessible
   - Check if other devices can connect
   - Verify the PowerSync service is running

## Common iOS Upgrade Issues

After iOS upgrades, these often get reset:
- ✅ Background App Refresh permissions
- ✅ Network permissions
- ✅ App data cache (sometimes)
- ✅ SSL certificate trust (rare)

The app now handles most of these automatically, but **Background App Refresh** must be manually enabled in iOS Settings.
