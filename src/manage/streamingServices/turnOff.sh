#!/bin/bash

# Script to turn off all ETL pipeline streaming services, including the strfry router

echo "Stopping streaming services..."

# Stop addToQueue service
systemctl stop addToQueue
sleep 1

# Stop processQueue service
systemctl stop processQueue
sleep 1

# Stop strfry-router
systemctl stop strfry-router
sleep 3

echo "Streaming services stopped successfully."

exit 0
