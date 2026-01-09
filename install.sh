#!/bin/bash

# Options Scanner - Cross-Platform Installer
# Works on macOS and Linux
# Usage: ./install.sh [--no-shortcuts] [--no-start]

set -e

# Detect OS
case "$(uname -s)" in
    Darwin*)    OS="macos" ;;
    Linux*)     OS="linux" ;;
    *)          OS="unknown" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$OS" = "macos" ]; then
    echo "Detected macOS - running macOS installer..."
    if [ -f "$SCRIPT_DIR/installer/macos/install.sh" ]; then
        exec "$SCRIPT_DIR/installer/macos/install.sh" "$@"
    elif [ -f "$SCRIPT_DIR/macos/install.sh" ]; then
        exec "$SCRIPT_DIR/macos/install.sh" "$@"
    else
        echo "macOS installer not found. Please run installer/macos/install.sh"
        exit 1
    fi
elif [ "$OS" = "linux" ]; then
    echo "Detected Linux - running Linux installer..."
    if [ -f "$SCRIPT_DIR/installer/linux/install.sh" ]; then
        exec "$SCRIPT_DIR/installer/linux/install.sh" "$@"
    elif [ -f "$SCRIPT_DIR/linux/install.sh" ]; then
        exec "$SCRIPT_DIR/linux/install.sh" "$@"
    else
        echo "Linux installer not found. Please run installer/linux/install.sh"
        exit 1
    fi
else
    echo "Unsupported operating system: $(uname -s)"
    echo ""
    echo "Supported systems:"
    echo "  - macOS (Darwin)"
    echo "  - Linux"
    echo "  - Windows (use installer\\windows\\install.bat)"
    exit 1
fi
