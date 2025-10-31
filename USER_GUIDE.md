# Stream-Agri Mobile App - User Guide

## Overview
Stream-Agri is a mobile application designed for agricultural management, connecting field officers with growers and tracking agricultural inputs, monitoring, and evaluation. The app works both online and offline, synchronizing data when internet connectivity is available.

## 🚀 Getting Started

### Prerequisites
- Mobile device with the Stream-Agri app installed
- Internet connection for initial setup
- Valid credentials provided by your administrator

---

## 📋 Initial Setup (Administrator)

### Step 1: Admin Configuration
Before field officers can use the app, an administrator must configure the server settings.

1. **Open the app** and tap **"Server Configuration"**
2. **Enter Server Configuration:**
   - **Server IP**: `your-server.com` or `www.tcoz.co.zw`
   - **Database Name**: `your_database_name` (e.g., `tcoz`)
   - **Admin Username**: `support@example.com`
   - **Admin Password**: `password123`
   - **PowerSync URI**: `https://your-powersync-instance.powersync.journeyapps.com`

3. **Tap "Login & Configure"**
4. Wait for the configuration to complete
5. The app will redirect to the field officer login screen

> **Note:** The app automatically adds `https://` to server URLs that don't include a protocol scheme.

---

## 👤 Field Officer Login

### Step 2: Field Officer Authentication

1. **Enter your credentials:**
   - **Phone Number**: `+263123456789` (your registered mobile number)
   - **Password**: `your_password`

2. **First-time login:**
   - Tap **"Login"**
   - The app will download employee data from the server
   - A progress bar will show the sync status
   - Wait for "Sync complete!" message

3. **Subsequent logins:**
   - Works offline after initial sync
   - Online authentication when internet is available
   - Automatic data synchronization in the background

---

## 🏠 Main Dashboard

After successful login, you'll see the main dashboard with:

- **Welcome message** with your name
- **Quick access tiles** for main features
- **Network status indicator** (WiFi icon)
- **Navigation tabs** at the bottom

### Dashboard Tiles:
- **Growers** - Manage farmer profiles
- **Inputs** - Track agricultural inputs
- **M & E** - Monitoring and evaluation
- **Export** - Database export functionality

---

## 👥 Growers Management

### Viewing Growers
1. Tap the **"Growers"** tab or tile
2. View list of registered growers production
3. Use search functionality to find specific grower productions

### Adding a New Grower Application
1. In the Growers section, tap **"New"** or **"Add Grower"**
2. Fill in grower information:
   - **Personal Details:**
     - Full Name: `John Doe`
     - National ID: `12-345678-A12`
     - Mobile Phone: `+263123456789`
     - Address: `123 Farm Road, Harare`
   
   - **Farm Information:**
     - Farm Size: `5.5 hectares`
     - Crop Type: `Maize, Tobacco`
     - Location: GPS coordinates or manual entry

   - **Photo Documentation:**
     - Grower portrait photo
     - National ID photo
     - Farm location photos

3. **Save** the grower profile (This will Create a New Grower Application)
4. Data will sync automatically when online

### Editing Grower Information
1. Tap on a grower from the list
2. Update necessary information
3. Save changes (This Too Will Create a New Grower Application)

---

## 🌱 Inputs Management

Track agricultural inputs distribution and returns.

### Viewing Inputs
1. Tap the **"Inputs"** tab
2. View three categories:
   - **Issued** - Inputs assigned to growers
   - **Received** - Inputs received from suppliers
   - **Returned** - Inputs returned by growers

### Recording Input Distribution
1. In Inputs section, tap **"Receive"**
2. Fill in the details:
   - **Grower Image**
   - **Grower National Id**
   - **Issue Voucher**
   - Coordinates are taken by default
   - 
3. **Save** the distribution record

### Recording Input Returns
1. Select **"Return"** tab
2. Confirm Goods Returns

3. Save the return record

---

## 📊 Monitoring & Evaluation (M & E)

### Creating Monitoring Reports
1. Tap the **"M & E"** tab
2. Tap **"Start Survey"**
3. Fill in current survey form:
   - **Grower**: Select grower first
   - **Fill The Rest depending on the survey**
4. **Save** the survey report

### Viewing Completed Reports
1. In M & E section, tap **"Completed"**
2. Browse historical survey data
3. Tap on reports to view details
4. Export reports when needed

---

## ⚙️ Settings

### Accessing Settings
1. Tap the **"Settings"** tab

### Data Management
- **Export Database**: Create local backups
- **Sync Status**: View last sync time
- **Storage Usage**: Check local storage

### Account Management
- **Logout**: Sign out of the app

---

## 🔄 Data Synchronization

### Understanding Sync Status
- **Green WiFi Icon**: Connected to the internet
- **Red WiFi Icon**: No internet connection
- **Green Plug Icon Bar**: Active sync in progress
- **Green Plug Icon Bar**: Not Sync in progress


### Offline Mode
- All functions work offline after initial setup
- Data is stored locally and synced when online
- Photos are uploaded when connectivity returns

---

## 📸 Photo Management

### Taking Photos
1. When prompted for photos, tap **"Take Photo"**
2. Allow camera permissions
3. Frame the subject properly
4. Tap capture button
5. Review and retake if needed

### Photo Guidelines
- **Grower Photos**: Clear face shot, good lighting
- **National ID**: All text visible, no glare

---

## 🚨 Troubleshooting

### Common Issues

#### "No internet connection" Error
- Check device internet connectivity
- Try switching between WiFi and mobile data
- Contact admin if server is unreachable

#### "User not found" Error
- Verify phone number is correct
- Ensure you're registered in the system
- Contact administrator to add your account

#### "Sync failed" Error
- Check internet connection
- Wait and try again later
- Contact technical support if persistent

#### Photos not uploading
- Check internet connection
- Verify camera permissions are enabled
- Try taking new photos with better lighting

### Getting Help
- **Technical Issues**: Contact support
- **User Account Issues**: Contact your supervisor

---


---

## 📱 Tips for Better Performance

1. **Battery Management**: Close app when not in use for extended periods
2. **Storage**: Regular export and clear old data if needed
3. **Updates**: Keep app updated through app store
4. **Network**: Use WiFi when available for faster sync
5. **Backup**: Regular data exports as backup measure

---