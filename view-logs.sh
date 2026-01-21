#!/bin/bash
# View logs for Expo app

echo "Choose platform:"
echo "1) Android (device connected via USB)"
echo "2) iOS (simulator)"
echo "3) Both"
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo "Starting Expo with Android logs..."
    npx expo start --android
    ;;
  2)
    echo "Starting Expo with iOS logs..."
    npx expo start --ios
    ;;
  3)
    echo "Starting Expo (logs will show for both)..."
    npx expo start
    ;;
  *)
    echo "Invalid choice"
    ;;
esac
