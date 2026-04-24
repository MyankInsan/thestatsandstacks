#!/bin/bash
# TheStatsAndStacks — Daily Automation Server
# This script starts the Next.js server which runs the daily 8 AM cron job

cd /Users/myank/Desktop/thestatsandstacks/platform

# Log output so you can check if something goes wrong
exec >> /Users/myank/Desktop/thestatsandstacks/platform/server.log 2>&1

echo ""
echo "═══════════════════════════════════════"
echo "  TheStatsAndStacks Server Starting"
echo "  $(date)"
echo "═══════════════════════════════════════"
echo ""

# Start the Next.js dev server
/usr/local/bin/npm run dev
