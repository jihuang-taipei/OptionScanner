#!/bin/bash

# Options Scanner - Logs Script
# View live application logs

echo ""
echo "============================================"
echo "   Options Scanner - Live Logs"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop viewing logs"
echo ""

cd "$(dirname "$0")"

# Use docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    docker-compose logs -f --tail=100
else
    docker compose logs -f --tail=100
fi
