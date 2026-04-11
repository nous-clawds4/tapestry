#!/bin/bash

# Script to turn on all Brainstorm services

echo "Starting Brainstorm services..."

# Source configuration
source /etc/brainstorm.conf

# Start Neo4j
echo "Starting Neo4j..."
systemctl start neo4j
sleep 5

# Start strfry
echo "Starting strfry..."
systemctl start strfry
sleep 3

# Start strfry-router
echo "Starting strfry-router..."
systemctl start strfry-router
sleep 3

# Start Brainstorm ETL pipeline services
echo "Starting Brainstorm ETL pipeline services..."

# Start addToQueue service
systemctl start addToQueue
sleep 1

# Start processQueue service
systemctl start processQueue
sleep 1

# Start reconcile timer
# This has been subsumed into the processAllTasks service
# systemctl start reconcile.timer
# sleep 1

# Start control panel
systemctl start brainstorm-control-panel
sleep 1

# Run initial Negentropy sync for Web of Trust events
echo "Initiating Negentropy sync for Web of Trust events..."
curl -s "http://localhost:3000/api/negentropy-sync?relay=wss://relay.primal.net&kinds=3,1984,10000" > /dev/null

echo "Brainstorm services started successfully."

exit 0
