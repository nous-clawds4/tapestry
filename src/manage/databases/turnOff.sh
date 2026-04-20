#!/bin/bash

# Script to turn off the strfry and Neo4j databases

echo "Stopping databases..."

# Stop strfry
systemctl stop strfry
sleep 3

# Stop Neo4j
systemctl stop neo4j
sleep 5

echo "Databases stopped successfully."

exit 0
