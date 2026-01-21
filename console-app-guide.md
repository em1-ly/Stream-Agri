# How to View iOS Device Logs in Console.app

## Step-by-Step Instructions:

### 1. Connect Your iOS Device
   - Connect your iPhone/iPad to your Mac via USB cable
   - Unlock your device and trust the computer if prompted

### 2. Open Console.app
   - Press `Cmd + Space` to open Spotlight
   - Type "Console" and press Enter
   - Or go to: Applications → Utilities → Console.app

### 3. Select Your Device
   - In the left sidebar, look under "Devices"
   - You should see your device name (e.g., "John's iPhone")
   - Click on your device name to select it
   - If you don't see it, make sure:
     - Device is unlocked
     - You've trusted the computer
     - USB cable is connected properly

### 4. Filter by App Name
   - At the top of Console.app, there's a search/filter box
   - Type: `TobaccoLogistics`
   - Press Enter
   - You'll now see only logs from your app

### 5. Additional Filtering Options

   **Filter by log level:**
   - Click the filter icon (funnel) in the toolbar
   - Select: Error, Fault, or Info

   **Filter by subsystem:**
   - In the search box, type: `subsystem:com.yourcompany.TobaccoLogistics`
   - (Replace with your actual bundle identifier)

   **Filter by process:**
   - Type: `process:TobaccoLogistics`

   **Combine filters:**
   - Type: `TobaccoLogistics error` (shows only errors from your app)
   - Type: `TobaccoLogistics warn` (shows warnings)

### 6. Clear Logs (Optional)
   - Right-click in the log window
   - Select "Clear Display" to start fresh

### 7. Save Logs (Optional)
   - Select the logs you want
   - File → Export Selected Messages
   - Save as .txt or .log file

## Quick Tips:

- **Real-time filtering**: As you type in the filter box, logs update in real-time
- **Case sensitive**: The filter is case-sensitive, so "TobaccoLogistics" must match exactly
- **Multiple filters**: You can use multiple search terms separated by spaces
- **Regex support**: Console.app supports regex patterns for advanced filtering

## Alternative: Command Line Method

If Console.app doesn't work, you can also use:

```bash
# View device logs via command line
xcrun devicectl device monitor logs --device <device-id> | grep -i "TobaccoLogistics"
```

To get device ID:
```bash
xcrun devicectl list devices
```
