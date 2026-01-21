# Fix Xcode Build Errors

## Steps to Fix:

1. **In Xcode, clean the build:**
   - Press `Shift + Cmd + K` (or Product → Clean Build Folder)
   - Wait for it to complete

2. **Close and reopen Xcode:**
   - Quit Xcode completely
   - Reopen: `open ios/TobaccoLogistics.xcworkspace`

3. **Reinstall Pods (if needed):**
   ```bash
   cd /Users/curveridsupport/Stream-Agri/ios
   pod install
   ```

4. **Try building again:**
   - In Xcode: Product → Build (Cmd + B)
   - Or Product → Archive for distribution

## What I Fixed:

- Removed `expo-dev-menu` bundle references from project.pbxproj
- Removed `expo-dev-launcher` bundle references from project.pbxproj

These shouldn't be in production builds anyway.

## If Errors Persist:

1. Delete DerivedData:
   - Xcode → Settings → Locations
   - Click arrow next to DerivedData path
   - Delete the TobaccoLogistics folder
   - Rebuild

2. Check Podfile is excluding dev dependencies for Release:
   - The Podfile should already have this configured
   - If not, the post_install hook should handle it
