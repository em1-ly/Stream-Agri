#!/usr/bin/env bash

# EAS Build Hook: Remove expo-dev-menu from production builds
# This hook runs before the build starts

set -euo pipefail

echo "🔧 Pre-build hook: Checking build profile..."

# Check if this is a production build
if [ "$EAS_BUILD_PROFILE" = "production" ]; then
  echo "📦 Production build detected - excluding expo-dev-menu..."
  
  # Set environment variable to exclude dev client
  export EXPO_NO_DEV_CLIENT=1
  
  # Modify Podfile.properties.json to disable dev client
  if [ -f "ios/Podfile.properties.json" ]; then
    echo "🔧 Disabling dev client in Podfile.properties.json..."
    # Use node to properly modify JSON
    node -e "
      const fs = require('fs');
      const path = 'ios/Podfile.properties.json';
      const props = JSON.parse(fs.readFileSync(path, 'utf8'));
      props['EX_DEV_CLIENT_NETWORK_INSPECTOR'] = 'false';
      fs.writeFileSync(path, JSON.stringify(props, null, 2) + '\n');
    "
    echo "✅ Dev client disabled in Podfile.properties.json"
  fi
  
  echo "✅ expo-dev-menu will be excluded from production build"
else
  echo "ℹ️  Non-production build - keeping expo-dev-menu"
fi

echo "✅ Pre-build hook completed"
