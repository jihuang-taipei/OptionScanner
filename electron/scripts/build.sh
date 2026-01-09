#!/bin/bash

# Options Scanner - Electron Build Script
# Builds the Electron app for specified platform(s)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   Options Scanner - Electron Build${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Parse arguments
PLATFORM=${1:-"current"}

# Step 1: Check Node.js
echo -e "${CYAN}[1/5]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js $(node --version)"

# Step 2: Build frontend
echo ""
echo -e "${CYAN}[2/5]${NC} Building frontend..."
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

npm run build
echo -e "${GREEN}[OK]${NC} Frontend built"

# Step 3: Install Electron dependencies
echo ""
echo -e "${CYAN}[3/5]${NC} Installing Electron dependencies..."
cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}[OK]${NC} Dependencies installed"

# Step 4: Create placeholder icons if not exist
echo ""
echo -e "${CYAN}[4/5]${NC} Checking assets..."

if [ ! -f "$PROJECT_DIR/assets/icon.png" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Creating placeholder icons..."
    # Create a simple placeholder (1x1 pixel PNG)
    echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$PROJECT_DIR/assets/icon.png"
    cp "$PROJECT_DIR/assets/icon.png" "$PROJECT_DIR/assets/tray-icon.png"
    echo -e "${YELLOW}[NOTE]${NC} Replace placeholder icons with real ones before distribution"
fi

# Step 5: Build Electron app
echo ""
echo -e "${CYAN}[5/5]${NC} Building Electron app for: $PLATFORM"

case $PLATFORM in
    "win"|"windows")
        npm run build:win
        ;;
    "mac"|"macos"|"darwin")
        npm run build:mac
        ;;
    "linux")
        npm run build:linux
        ;;
    "all")
        npm run build:all
        ;;
    "current"|*)
        npm run build
        ;;
esac

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Build Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Output directory: $PROJECT_DIR/dist/"
echo ""
ls -la "$PROJECT_DIR/dist/" 2>/dev/null || echo "Check dist/ folder for built applications"
