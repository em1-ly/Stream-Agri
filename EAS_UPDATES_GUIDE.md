# EAS Build & Remote Updates Guide

## Step 1: Build the Production IPA

```bash
eas build --platform ios --profile production
```

This will:
- Build your app with expo-updates enabled
- Create an IPA ready for App Store distribution
- Configure the app to receive remote updates via the "production" channel

## Step 2: After Build Completes

Once your build is complete, you can publish JavaScript/asset updates without rebuilding:

### Publish an Update

```bash
eas update --branch production --message "Your update description"
```

This will:
- Bundle your current JavaScript and assets
- Upload to EAS Update servers
- Make it available to all users on the "production" channel
- Users will receive the update on next app launch

### Publish to a Specific Channel

```bash
eas update --channel production --message "Bug fixes and improvements"
```

### View Update Status

```bash
eas update:list --branch production
```

## Step 3: Update Workflow

### Making Code Changes

1. Make your JavaScript/TypeScript changes
2. Test locally
3. Publish update:
   ```bash
   eas update --branch production --message "Fixed barcode scanning issue"
   ```

### When to Rebuild (Not Just Update)

You need to rebuild the IPA when:
- Adding/removing native dependencies
- Changing native code
- Updating `runtimeVersion` in app.json
- Changing app permissions
- Updating app icon/splash screen (sometimes)

### When You Can Just Update

You can publish updates for:
- JavaScript/TypeScript code changes
- UI changes
- Bug fixes
- New features (if no native changes)
- Asset changes (images, fonts, etc.)

## Step 4: Runtime Version Management

Your current `runtimeVersion` is `1.0.0`. This means:
- All builds with `runtimeVersion: "1.0.0"` can receive the same updates
- If you change `runtimeVersion` to `1.0.1`, you'll need to rebuild
- Users on `1.0.0` won't get updates for `1.0.1` builds

### Best Practice

- Keep the same `runtimeVersion` for multiple builds if possible
- Only increment when you need to break compatibility (new native modules, etc.)

## Step 5: Testing Updates

### Test Update Before Production

1. Build a preview build:
   ```bash
   eas build --platform ios --profile preview
   ```

2. Publish to preview channel:
   ```bash
   eas update --channel preview --message "Test update"
   ```

3. Test on preview build

4. If good, publish to production:
   ```bash
   eas update --channel production --message "Same update"
   ```

## Quick Reference

```bash
# Build production IPA
eas build --platform ios --profile production

# Publish update (after code changes)
eas update --branch production --message "Update description"

# List all updates
eas update:list --branch production

# View update details
eas update:view <update-id>

# Rollback an update (if needed)
eas update:rollback --branch production
```

## Important Notes

1. **First Build**: The first production build must be done via `eas build`
2. **Updates Only**: After that, you can use `eas update` for JavaScript/asset changes
3. **App Store**: You still need to submit the IPA to App Store Connect for distribution
4. **User Experience**: Updates download in the background and apply on next app launch
5. **Automatic**: Updates are checked automatically on app load (configured in app.json)

## Troubleshooting

### Update Not Appearing

1. Check update was published:
   ```bash
   eas update:list --branch production
   ```

2. Verify runtimeVersion matches:
   - Build runtimeVersion must match update runtimeVersion

3. Check channel/branch:
   - Make sure you're publishing to the same channel as the build

### Force Update Check

Users can force an update check by:
- Closing and reopening the app
- Updates check automatically on app launch

