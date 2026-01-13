#!/bin/sh

# Start the main server in the background
npm start &

# Start the keep-alive script in the background
node scripts/keep-alive.js &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?