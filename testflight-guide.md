# How to Get Your App to TestFlight

## Step 1: Build the IPA for App Store

```bash
eas build --platform ios --profile production
```

This will:
- Build a new IPA with your latest code
- Configure it for App Store distribution
- Upload it to EAS servers
- Takes about 20-30 minutes

## Step 2: Submit to App Store Connect

Once the build completes, submit it to App Store Connect:

```bash
eas submit --platform ios --profile production
```

This will:
- Upload the IPA to App Store Connect
- Make it available in TestFlight

**Note:** You'll need to:
- Be logged into your Apple Developer account
- Have the app configured in App Store Connect
- Have valid certificates and provisioning profiles (EAS handles this)

## Step 3: Distribute via TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → Select your app
3. Go to **TestFlight** tab
4. Your build will appear under "iOS Builds"
5. Add it to a TestFlight group or create a new one
6. Add testers (internal or external)

## Alternative: Automatic Submission

You can also configure EAS to automatically submit after build:

```bash
eas build --platform ios --profile production --auto-submit
```

## Important Notes:

### EAS Updates vs New Builds:
- **EAS Update** (what you just did): JavaScript/asset updates for existing installs
- **New Build**: Complete new IPA that goes to TestFlight/App Store

### When to Build vs Update:
- **Build new IPA** when:
  - Adding native dependencies
  - Changing native code
  - First time submitting to TestFlight
  - Need to update version/build number
  - Changing app permissions
  
- **Use EAS Update** when:
  - Only JavaScript/TypeScript changes
  - UI updates
  - Bug fixes (no native changes)
  - Asset updates

## Quick Commands:

```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production

# Build and submit automatically
eas build --platform ios --profile production --auto-submit

# Check build status
eas build:list

# View build details
eas build:view <build-id>
```

## For Your 20 Devices:

Once the build is in TestFlight:
1. Add the shared Apple ID to TestFlight testers
2. Install TestFlight app on all 20 devices
3. Sign in with the shared Apple ID
4. Install your app from TestFlight
5. All devices will get updates automatically
