import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
// import { useSQLiteContext } from "expo-sqlite"

// Add this function to your app
export const exportDatabase = async () => {
  try {    
    // Get the database file path
    const dbPath = `${FileSystem.documentDirectory}SQLite/app.db`;
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    
    if (fileInfo.exists) {
      console.log("Database found at:", dbPath);
      // Share the file so you can save it to your computer
      await Sharing.shareAsync(dbPath);
    } else {
      console.log("Database file not found");
    }
  } catch (error) {
    console.error("Export error:", error);
  }
};