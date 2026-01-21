# Expo Updates Quick Reference

## ✅ Your Current Setup

- **expo-updates**: ✅ Installed (v0.27.4)
- **Runtime Version**: `1.0.0` (in app.json)
- **Update URL**: Configured
- **Channel**: `production` (in eas.json)
- **Auto-check**: `ON_LOAD` (checks on app launch)

## 📤 How to Publish Updates

### Basic Update (Production Channel)
```bash
eas update --branch production --message "Your update description"
```

### Update with Specific Message
```bash
eas update --branch production --message "Fixed admin login clear data issue"
```

### Update Both Platforms
```bash
eas update --branch production --message "Bug fixes" --platform all
```

### Update Specific Platform
```bash
# iOS only
eas update --branch production --message "iOS fix" --platform ios

# Android only
eas update --branch production --message "Android fix" --platform android
```

## 📋 View Update Status

### List All Updates
```bash
eas update:list --branch production
```

### View Specific Update
```bash
eas update:view <update-id>
```

### Check Current Update on Device
The app automatically checks for updates on launch (configured in app.json).

## 🔄 Update Workflow

### 1. Make Your Changes
Edit your JavaScript/TypeScript files (like you did with `adminLogin.tsx`)

### 2. Test Locally
```bash
npx expo start
```

### 3. Publish Update
```bash
eas update --branch production --message "Describe your changes"
```

### 4. Users Get Update
- App checks for updates on launch
- Update downloads in background
- Applies on next app restart

## ⚠️ Important Notes

### When to Use Updates (No New Build Needed):
✅ JavaScript/TypeScript code changes
✅ UI/UX changes
✅ Bug fixes (no native changes)
✅ Asset updates (images, fonts)
✅ Configuration changes

### When You MUST Build New IPA:
❌ Adding/removing native dependencies
❌ Changing native code
❌ Updating `runtimeVersion` in app.json
❌ Changing app permissions
❌ First time distribution

## 🎯 Runtime Version Management

Your current `runtimeVersion` is `1.0.0`:
- All builds with `runtimeVersion: "1.0.0"` can receive the same updates
- If you change it to `1.0.1`, you'll need to rebuild
- Users on `1.0.0` won't get updates for `1.0.1` builds

**Best Practice**: Keep the same `runtimeVersion` for multiple builds when possible.

## 🔧 Advanced Options

### Rollback an Update
```bash
eas update:rollback --branch production
```

### Publish to Preview Channel
```bash
eas update --branch preview --message "Testing new feature"
```

### View Update History
```bash
eas update:list --branch production --limit 10
```

## 📱 For Your 20 Devices

Once you publish an update:
1. All devices with the app installed will check for updates on next launch
2. Update downloads automatically in background
3. Users just need to close and reopen the app
4. No action needed on devices - it's automatic!

## 🚀 Quick Commands Cheat Sheet

```bash
# Publish update
eas update --branch production --message "Update description"

# List updates
eas update:list --branch production

# View update details
eas update:view <update-id>

# Rollback
eas update:rollback --branch production

# Check what will be published
eas update --branch production --message "Test" --dry-run
```

## 📊 Your Update Configuration

**app.json:**
```json
{
  "runtimeVersion": "1.0.0",
  "updates": {
    "url": "https://u.expo.dev/4874d33f-e492-4895-9c63-4bf6b360725a",
    "checkAutomatically": "ON_LOAD",
    "fallbackToCacheTimeout": 0
  }
}
```

**eas.json:**
```json
{
  "production": {
    "channel": "production"
  }
}
```

## 💡 Pro Tips

1. **Always test locally first** before publishing
2. **Use descriptive messages** so you can track what changed
3. **Keep runtimeVersion consistent** unless you need to break compatibility
4. **Monitor updates** with `eas update:list` to see what's live
5. **Use preview channel** for testing before production

## 🆘 Troubleshooting

### Update Not Appearing?
1. Check it was published: `eas update:list --branch production`
2. Verify runtimeVersion matches between build and update
3. Make sure channel matches (production build → production channel)
4. Force app restart (close completely and reopen)

### Need to Force Update Check?
Users can force check by:
- Completely closing the app
- Reopening it (triggers `ON_LOAD` check)
