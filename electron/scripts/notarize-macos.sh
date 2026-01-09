#!/bin/bash

# macOS Notarization Script
# Manually notarize a built application if automatic notarization failed

set -e

echo "============================================"
echo "   macOS Notarization Tool"
echo "============================================"
echo ""

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: This script must be run on macOS"
    exit 1
fi

# Check required environment variables
if [ -z "$APPLE_ID" ]; then
    read -p "Enter Apple ID: " APPLE_ID
fi

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    read -s -p "Enter app-specific password: " APPLE_APP_SPECIFIC_PASSWORD
    echo ""
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    read -p "Enter Team ID: " APPLE_TEAM_ID
fi

# Get the file to notarize
FILE_PATH="$1"

if [ -z "$FILE_PATH" ]; then
    echo "Usage: $0 <path-to-app-or-dmg>"
    echo ""
    echo "Examples:"
    echo "  $0 dist/Options\\ Scanner-1.0.0-mac-x64.dmg"
    echo "  $0 dist/mac/Options\\ Scanner.app"
    exit 1
fi

if [ ! -e "$FILE_PATH" ]; then
    echo "Error: File not found: $FILE_PATH"
    exit 1
fi

FILE_NAME=$(basename "$FILE_PATH")
echo "File: $FILE_NAME"
echo ""

# Determine if it's an app bundle or DMG
if [[ "$FILE_PATH" == *.app ]]; then
    echo "Detected: Application bundle"
    echo "Creating ZIP for notarization..."
    
    ZIP_PATH="/tmp/${FILE_NAME%.app}.zip"
    ditto -c -k --keepParent "$FILE_PATH" "$ZIP_PATH"
    SUBMIT_PATH="$ZIP_PATH"
elif [[ "$FILE_PATH" == *.dmg ]]; then
    echo "Detected: DMG file"
    SUBMIT_PATH="$FILE_PATH"
elif [[ "$FILE_PATH" == *.zip ]]; then
    echo "Detected: ZIP file"
    SUBMIT_PATH="$FILE_PATH"
else
    echo "Error: Unsupported file type. Use .app, .dmg, or .zip"
    exit 1
fi

echo ""

# Submit for notarization
echo "Submitting for notarization..."
echo ""

SUBMIT_RESULT=$(xcrun notarytool submit "$SUBMIT_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait \
    --output-format json 2>&1)

echo "$SUBMIT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SUBMIT_RESULT"

# Check result
STATUS=$(echo "$SUBMIT_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "unknown")
SUBMISSION_ID=$(echo "$SUBMIT_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null || echo "")

echo ""

if [ "$STATUS" = "Accepted" ]; then
    echo "✅ Notarization successful!"
    echo ""
    
    # Staple the notarization ticket
    if [[ "$FILE_PATH" == *.app ]]; then
        echo "Stapling ticket to app bundle..."
        xcrun stapler staple "$FILE_PATH"
        echo "✅ Ticket stapled to app"
        
        # Clean up temp ZIP
        rm -f "$ZIP_PATH"
    elif [[ "$FILE_PATH" == *.dmg ]]; then
        echo "Stapling ticket to DMG..."
        xcrun stapler staple "$FILE_PATH"
        echo "✅ Ticket stapled to DMG"
    fi
    
    echo ""
    echo "Verification:"
    xcrun stapler validate "$FILE_PATH" && echo "✅ Stapler validation passed"
    
elif [ "$STATUS" = "Invalid" ]; then
    echo "❌ Notarization failed!"
    echo ""
    
    if [ -n "$SUBMISSION_ID" ]; then
        echo "Getting detailed log..."
        xcrun notarytool log "$SUBMISSION_ID" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_APP_SPECIFIC_PASSWORD" \
            --team-id "$APPLE_TEAM_ID"
    fi
    
    exit 1
else
    echo "⚠️  Unknown status: $STATUS"
    echo ""
    
    if [ -n "$SUBMISSION_ID" ]; then
        echo "Check status with:"
        echo "  xcrun notarytool info $SUBMISSION_ID --apple-id \"$APPLE_ID\" --password \"***\" --team-id \"$APPLE_TEAM_ID\""
    fi
    
    exit 1
fi

echo ""
echo "============================================"
echo "   Notarization Complete"
echo "============================================"
