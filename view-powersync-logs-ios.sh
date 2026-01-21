#!/bin/bash
# View PowerSync logs on iOS device

DEVICE_ID="F6F6FF40-C167-538A-B91E-3DF2EB56C291"

echo "Streaming PowerSync logs from Emily's iPhone..."
echo "Press Ctrl+C to stop"
echo ""
echo "Filtering for: PowerSync|powersync|uploadData|unified_create|🔄|📤|⚠️"
echo ""

xcrun devicectl device monitor logs --device "$DEVICE_ID" 2>&1 | grep -i --line-buffered "PowerSync\|powersync\|uploadData\|unified_create\|🔄\|📤\|⚠️\|sync\|Sync"
