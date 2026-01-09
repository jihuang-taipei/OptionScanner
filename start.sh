#!/bin/bash

# Options Scanner - Start Script
# Cross-platform startup script for macOS and Linux

echo ""
echo "============================================"
echo "   Starting Options Scanner"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# Check Docker
if ! docker info &> /dev/null; then
    echo "[ERROR] Docker is not running."
    
    case "$(uname -s)" in
        Darwin*)
            echo "Please start Docker Desktop from Applications."
            ;;
        Linux*)
            echo "Start Docker: sudo systemctl start docker"
            ;;
    esac
    exit 1
fi

echo "[OK] Docker is running"
echo "Starting containers..."

# Use docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to start containers."
    exit 1
fi

echo ""
echo "============================================"
echo "   Options Scanner Started!"
echo "============================================"
echo ""
echo "Opening browser in 5 seconds..."
sleep 5

# Open browser based on OS
case "$(uname -s)" in
    Darwin*)
        open http://localhost:8000
        ;;
    Linux*)
        if command -v xdg-open &> /dev/null; then
            xdg-open http://localhost:8000 2>/dev/null || true
        elif command -v gnome-open &> /dev/null; then
            gnome-open http://localhost:8000 2>/dev/null || true
        fi
        ;;
esac

echo ""
echo "Application URL: http://localhost:8000"
echo ""
echo "To stop: ./stop.sh"
