# Xcode Distribution Guide

## Prerequisites

1. **Xcode installed** (latest version recommended)
2. **Apple Developer account** (Team ID: Q8SVVQWR37)
3. **Valid provisioning profiles** (should be auto-managed by Xcode)
4. **CocoaPods dependencies installed**

## Step 1: Install Dependencies

```bash
cd /Users/curveridsupport/Stream-Agri/ios
pod install
```

## Step 2: Open Workspace in Xcode

**Important:** Always open the `.xcworkspace` file, NOT the `.xcodeproj` file!

```bash
open ios/TobaccoLogistics.xcworkspace
```

Or manually:
- Open Xcode
- File → Open
- Navigate to: `ios/TobaccoLogistics.xcworkspace`
- Click Open

## Step 3: Configure Build Settings

1. In Xcode, select the **TobaccoLogistics** project in the left sidebar
2. Select the **TobaccoLogistics** target
3. Go to **General** tab:
   - **Version**: 1.0.1 (matches app.json)
   - **Build**: Increment this number for each build
   - **Bundle Identifier**: `ios.streamagri`
   - **Team**: Select your team (Q8SVVQWR37)

4. Go to **Signing & Capabilities**:
   - **Automatically manage signing**: ✅ Checked
   - **Team**: Your team should be selected
   - **Provisioning Profile**: Should be auto-generated

## Step 4: Select Build Scheme

1. At the top of Xcode, next to the play/stop buttons
2. Select: **TobaccoLogistics** scheme
3. Select: **Any iOS Device** (or your connected device for testing)

## Step 5: Archive the Build

1. **Product** → **Archive**
2. Wait for the build to complete (5-15 minutes)
3. The Organizer window will open automatically when done

## Step 6: Distribute to App Store Connect

1. In the **Organizer** window (Xcode → Window → Organizer if it didn't open)
2. Select your archive
3. Click **Distribute App**
4. Choose distribution method:
   - **App Store Connect** (for TestFlight/App Store)
   - **Ad Hoc** (for direct device installation)
   - **Enterprise** (if you have enterprise account)
   - **Development** (for testing)

5. For **App Store Connect**:
   - Click **Next**
   - Select **Upload** (or Export if you want the IPA file)
   - Click **Next**
   - Review options (usually defaults are fine)
   - Click **Upload**
   - Wait for upload to complete

## Step 7: Submit to TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → Your app
3. Go to **TestFlight** tab
4. Your build will appear under "iOS Builds" (may take 10-30 minutes to process)
5. Once processing is complete:
   - Click **+** to add to a TestFlight group
   - Add testers
   - Testers will receive email notifications

## Quick Commands

```bash
# Install CocoaPods dependencies
cd ios && pod install

# Open workspace in Xcode
open ios/TobaccoLogistics.xcworkspace

# Clean build folder (if needed)
# In Xcode: Product → Clean Build Folder (Shift+Cmd+K)
```

## Troubleshooting

### "No such module" errors
```bash
cd ios
pod install
# Then reopen Xcode
```

### Code signing errors
- Check Team is selected in Signing & Capabilities
- Ensure "Automatically manage signing" is checked
- Xcode should auto-generate provisioning profiles

### Build fails
- Clean build folder: Product → Clean Build Folder
- Delete DerivedData: Xcode → Preferences → Locations → Derived Data → Delete

### Version mismatch
- Make sure `MARKETING_VERSION` in Xcode matches `version` in app.json
- Current: app.json says 1.0.1, Xcode shows 1.0 - update Xcode to 1.0.1

## Important Notes

1. **Always use .xcworkspace**, never .xcodeproj directly
2. **Increment Build number** for each new archive
3. **Version** should match app.json version
4. **Runtime Version** (1.0.0) is separate from app version
5. **Expo Updates** will still work after Xcode distribution

## For Your 20 Devices

Once uploaded to TestFlight:
1. Add shared Apple ID to TestFlight testers
2. Install TestFlight app on devices
3. Sign in with shared Apple ID
4. Install your app from TestFlight
5. Updates via Expo Updates will work automatically
