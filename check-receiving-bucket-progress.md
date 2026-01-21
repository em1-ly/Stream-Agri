# Check receiving_bucket Sync Progress

## Method 1: Query Local Database Counts

You can check how many records are synced locally for each table in receiving_bucket:

```sql
-- Check counts for main receiving_bucket tables
SELECT 
  'receiving_grower_delivery_note' as table_name,
  COUNT(*) as record_count
FROM receiving_grower_delivery_note
WHERE create_date > '2025-09-25'
UNION ALL
SELECT 
  'receiving_transporter_delivery_note',
  COUNT(*)
FROM receiving_transporter_delivery_note
WHERE create_date > '2025-09-25'
UNION ALL
SELECT 
  'receiving_bale',
  COUNT(*)
FROM receiving_bale
UNION ALL
SELECT 
  'receiving_curverid_bale_sequencing_model',
  COUNT(*)
FROM receiving_curverid_bale_sequencing_model
WHERE scan_date::date = CURRENT_DATE
UNION ALL
SELECT 
  'warehouse_warehouse',
  COUNT(*)
FROM warehouse_warehouse
UNION ALL
SELECT 
  'warehouse_location',
  COUNT(*)
FROM warehouse_location
UNION ALL
SELECT 
  'warehouse_product',
  COUNT(*)
FROM warehouse_product;
```

## Method 2: Check PowerSync Status

In your app, check PowerSync connection and sync status:
- Settings → Check sync status icon (WiFi icon)
- Login screen shows sync progress
- Console.app logs show PowerSync status

## Method 3: View in App (SyncLogs Screen)

Go to: **Settings → Sync Logs**
This shows PowerSync errors and warnings from system_logs table.

## What to Look For

**Sync Issues:**
- PowerSync not connected (red WiFi icon)
- Errors in SyncLogs screen
- Tables showing 0 records when they should have data
- "Sync in progress" stuck

**Normal Sync:**
- Green WiFi icon = connected
- Records appearing in tables
- No errors in SyncLogs
