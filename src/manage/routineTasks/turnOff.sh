#!/bin/bash

# Script to turn off processAllTasks timer service

echo "Stopping processAllTasks timer service..."

# Stop processAllTasks timer
systemctl stop processAllTasks.timer

echo "processAllTasks timer service stopped successfully."

exit 0