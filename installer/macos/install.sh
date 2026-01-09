#!/bin/bash

# Options Scanner - macOS Installer
# Usage: ./install.sh [--no-shortcuts] [--no-start]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Options Scanner"
INSTALL_DIR="$HOME/OptionsScanner"
APP_BUNDLE_DIR="/Applications/Options Scanner.app"

# Parse arguments
NO_SHORTCUTS=false
NO_START=false
for arg in "$@"; do
    case $arg in
        --no-shortcuts) NO_SHORTCUTS=true ;;
        --no-start) NO_START=true ;;
    esac
done

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   Options Scanner - macOS Installer${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Function to print status
print_step() {
    echo -e "${CYAN}[$1]${NC} $2"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Check prerequisites
print_step "1/6" "Checking prerequisites..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed."
    echo ""
    echo "Please install Docker Desktop for macOS:"
    echo "  https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "After installing:"
    echo "  1. Open Docker Desktop from Applications"
    echo "  2. Wait for it to fully start (whale icon in menu bar)"
    echo "  3. Run this installer again"
    echo ""
    exit 1
fi

print_ok "Docker is installed: $(docker --version)"

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running."
    echo ""
    echo "Please start Docker Desktop and wait for it to initialize."
    echo "Look for the whale icon in your menu bar."
    echo ""
    exit 1
fi

print_ok "Docker is running"
echo ""

# Step 2: Create installation directory
print_step "2/6" "Creating installation directory..."

if [ -d "$INSTALL_DIR" ]; then
    echo -n "Installation directory exists. Overwrite? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"
print_ok "Created $INSTALL_DIR"
echo ""

# Step 3: Copy files
print_step "3/6" "Copying application files..."

# Determine source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../.."

# Check if we're in the right place
if [ ! -f "$SOURCE_DIR/Dockerfile" ]; then
    SOURCE_DIR="$SCRIPT_DIR/.."
fi
if [ ! -f "$SOURCE_DIR/Dockerfile" ]; then
    SOURCE_DIR="$SCRIPT_DIR"
fi

if [ -d "$SOURCE_DIR/backend" ]; then
    cp -r "$SOURCE_DIR/backend" "$INSTALL_DIR/"
    cp -r "$SOURCE_DIR/frontend" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/Dockerfile" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/docker-compose.yml" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/docker-compose.dev.yml" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR"/*.md "$INSTALL_DIR/" 2>/dev/null || true
    print_ok "Application files copied"
else
    print_error "Could not find application files."
    echo "Please run this installer from the Options Scanner directory."
    exit 1
fi
echo ""

# Step 4: Create startup scripts
print_step "4/6" "Creating startup scripts..."

# Start script
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
echo ""
echo "============================================"
echo "   Starting Options Scanner"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# Check Docker
if ! docker info &> /dev/null; then
    echo "[ERROR] Docker is not running."
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo "[OK] Docker is running"
echo "Starting containers..."

docker-compose up -d

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

# Open browser (macOS)
if command -v open &> /dev/null; then
    open http://localhost:8000
# Open browser (Linux)
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000
fi

echo ""
echo "Application URL: http://localhost:8000"
echo ""
echo "To stop: ./stop.sh"
EOF

# Stop script
cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash
echo ""
echo "============================================"
echo "   Stopping Options Scanner"
echo "============================================"
echo ""

cd "$(dirname "$0")"
docker-compose down

echo ""
echo "Options Scanner stopped."
echo "Your data is preserved for next time."
EOF

# Logs script
cat > "$INSTALL_DIR/logs.sh" << 'EOF'
#!/bin/bash
echo ""
echo "============================================"
echo "   Options Scanner - Live Logs"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop viewing logs"
echo ""

cd "$(dirname "$0")"
docker-compose logs -f --tail=100
EOF

# Status script
cat > "$INSTALL_DIR/status.sh" << 'EOF'
#!/bin/bash
echo ""
echo "Options Scanner Status:"
echo ""
cd "$(dirname "$0")"
docker-compose ps
EOF

# Uninstall script
cat > "$INSTALL_DIR/uninstall.sh" << EOF
#!/bin/bash
echo ""
echo "============================================"
echo "   Options Scanner - Uninstaller"
echo "============================================"
echo ""
echo -n "Are you sure you want to uninstall? (y/N): "
read -r response
if [[ ! "\$response" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Stopping containers..."
cd "$INSTALL_DIR"
docker-compose down -v 2>/dev/null

echo "Removing Docker images..."
docker rmi optionsscanner-option-scanner 2>/dev/null || true

echo "Removing installation directory..."
rm -rf "$INSTALL_DIR"

echo "Removing application bundle..."
rm -rf "$APP_BUNDLE_DIR"

echo ""
echo "Options Scanner has been uninstalled."
EOF

# Make scripts executable
chmod +x "$INSTALL_DIR"/*.sh

print_ok "Startup scripts created"
echo ""

# Step 5: Create macOS app bundle (optional)
if [ "$NO_SHORTCUTS" = false ]; then
    print_step "5/6" "Creating macOS application bundle..."
    
    # Create app bundle structure
    mkdir -p "$APP_BUNDLE_DIR/Contents/MacOS"
    mkdir -p "$APP_BUNDLE_DIR/Contents/Resources"
    
    # Create executable
    cat > "$APP_BUNDLE_DIR/Contents/MacOS/Options Scanner" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
./start.sh
EOF
    chmod +x "$APP_BUNDLE_DIR/Contents/MacOS/Options Scanner"
    
    # Create Info.plist
    cat > "$APP_BUNDLE_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Options Scanner</string>
    <key>CFBundleIdentifier</key>
    <string>com.optionsscanner.app</string>
    <key>CFBundleName</key>
    <string>Options Scanner</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF
    
    print_ok "Application bundle created in /Applications"
else
    print_step "5/6" "Skipping application bundle (--no-shortcuts)"
fi
echo ""

# Step 6: Build Docker images
print_step "6/6" "Building Docker images (this may take several minutes)..."
echo ""

cd "$INSTALL_DIR"
docker-compose build

if [ $? -ne 0 ]; then
    print_error "Failed to build Docker images."
    echo "Please check Docker is running correctly and try again."
    exit 1
fi

print_ok "Docker images built successfully"
echo ""

# Installation complete
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Installation Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Options Scanner installed to:"
echo "  $INSTALL_DIR"
echo ""
echo "Application bundle (if created):"
echo "  /Applications/Options Scanner.app"
echo ""
echo "To start:"
echo "  - Open 'Options Scanner' from Applications, or"
echo "  - Run: $INSTALL_DIR/start.sh"
echo ""
echo "Application URL:"
echo "  http://localhost:8000"
echo ""

# Start application
if [ "$NO_START" = false ]; then
    echo -n "Start Options Scanner now? (Y/n): "
    read -r response
    if [[ ! "$response" =~ ^[Nn]$ ]]; then
        echo ""
        "$INSTALL_DIR/start.sh"
    fi
fi

echo ""
echo "Installation complete!"
