#!/bin/bash

# Options Scanner - Stop Script
# Cross-platform stop script for macOS and Linux

echo ""
echo "============================================"
echo "   Stopping Options Scanner"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# Use docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    docker-compose down
else
    docker compose down
fi

echo ""
echo "Options Scanner stopped."
echo "Your data is preserved for next time."
