#!/bin/bash

# Script to turn off all Brainstorm services

echo "Stopping Brainstorm services..."

# Source configuration
source /etc/brainstorm.conf

# Stop Brainstorm ETL pipeline services
echo "Stopping Brainstorm ETL pipeline services..."

# Stop reconcile timer
# This has been subsumed into the processAllTasks service
# systemctl stop reconcile.timer
# sleep 1

# Stop processQueue service
systemctl stop processQueue
sleep 1

# Stop addToQueue service
systemctl stop addToQueue
sleep 1

# Stop control panel (keep this running so we can turn things back on)
# systemctl stop brainstorm-control-panel
# sleep 1

# Stop strfry-router
echo "Stopping strfry-router..."
systemctl stop strfry-router
sleep 3

# Stop strfry
echo "Stopping strfry..."
systemctl stop strfry
sleep 3

# Stop Neo4j
echo "Stopping Neo4j..."
systemctl stop neo4j
sleep 5

echo "Brainstorm services stopped successfully."

exit 0
