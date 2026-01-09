#!/bin/bash

# macOS Code Signing Setup Script
# Run this to verify and prepare your macOS signing setup

set -e

echo "============================================"
echo "   macOS Code Signing Setup"
echo "============================================"
echo ""

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: This script must be run on macOS"
    exit 1
fi

# Step 1: Check for Developer ID certificates
echo "[1/5] Checking for Developer ID certificates..."
echo ""

CERTS=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" || true)

if [ -z "$CERTS" ]; then
    echo "❌ No Developer ID Application certificates found"
    echo ""
    echo "To create certificates:"
    echo "  1. Open Xcode → Preferences → Accounts"
    echo "  2. Select your Apple ID"
    echo "  3. Click 'Manage Certificates'"
    echo "  4. Click '+' and create 'Developer ID Application'"
    echo ""
    exit 1
else
    echo "✅ Found Developer ID certificates:"
    echo "$CERTS"
    echo ""
fi

# Extract team ID
TEAM_ID=$(echo "$CERTS" | head -1 | grep -o '([A-Z0-9]*)'  | tr -d '()' | head -1)
echo "Team ID: $TEAM_ID"
echo ""

# Step 2: Check for notarization credentials
echo "[2/5] Checking notarization setup..."
echo ""

if [ -n "$APPLE_ID" ]; then
    echo "✅ APPLE_ID is set: $APPLE_ID"
else
    echo "⚠️  APPLE_ID not set"
    read -p "Enter your Apple ID email: " APPLE_ID
fi

if [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "✅ APPLE_APP_SPECIFIC_PASSWORD is set"
else
    echo "⚠️  APPLE_APP_SPECIFIC_PASSWORD not set"
    echo ""
    echo "Create an app-specific password at:"
    echo "  https://appleid.apple.com → Security → App-Specific Passwords"
    echo ""
    read -s -p "Enter app-specific password: " APPLE_APP_SPECIFIC_PASSWORD
    echo ""
fi

if [ -n "$APPLE_TEAM_ID" ]; then
    echo "✅ APPLE_TEAM_ID is set: $APPLE_TEAM_ID"
else
    APPLE_TEAM_ID="$TEAM_ID"
    echo "✅ Using Team ID from certificate: $APPLE_TEAM_ID"
fi

echo ""

# Step 3: Verify notarization credentials
echo "[3/5] Verifying notarization credentials..."
echo ""

xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --limit 1 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Notarization credentials are valid"
else
    echo "❌ Notarization credentials invalid"
    echo "Please check your Apple ID and app-specific password"
    exit 1
fi

echo ""

# Step 4: Check entitlements file
echo "[4/5] Checking entitlements..."
echo ""

ENTITLEMENTS_FILE="$(dirname "$0")/../assets/entitlements.mac.plist"
if [ -f "$ENTITLEMENTS_FILE" ]; then
    echo "✅ Entitlements file found: $ENTITLEMENTS_FILE"
    echo ""
    echo "Contents:"
    cat "$ENTITLEMENTS_FILE"
else
    echo "⚠️  Entitlements file not found"
    echo "Creating default entitlements..."
    
    cat > "$ENTITLEMENTS_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
EOF
    echo "✅ Created entitlements file"
fi

echo ""

# Step 5: Export certificate for CI/CD
echo "[5/5] Exporting certificate for CI/CD..."
echo ""

# Find the certificate name
CERT_NAME=$(echo "$CERTS" | head -1 | sed 's/.*"\(.*\)".*/\1/')

read -p "Export certificate for CI/CD? (y/N): " EXPORT_CERT
if [[ "$EXPORT_CERT" =~ ^[Yy]$ ]]; then
    EXPORT_PATH="$HOME/Desktop/macos-certificate.p12"
    
    read -s -p "Enter a password for the exported certificate: " EXPORT_PASSWORD
    echo ""
    
    security export -k login.keychain -t identities -f pkcs12 -P "$EXPORT_PASSWORD" -o "$EXPORT_PATH" 2>/dev/null
    
    if [ -f "$EXPORT_PATH" ]; then
        echo "✅ Certificate exported to: $EXPORT_PATH"
        
        # Base64 encode
        BASE64_CERT=$(base64 -i "$EXPORT_PATH" | tr -d '\n')
        
        echo ""
        echo "For CI/CD, add these GitHub secrets:"
        echo ""
        echo "  MACOS_CERTIFICATE: (see file: $HOME/Desktop/macos-certificate-base64.txt)"
        echo "  MACOS_CERTIFICATE_PWD: <the password you entered>"
        echo "  APPLE_ID: $APPLE_ID"
        echo "  APPLE_APP_SPECIFIC_PASSWORD: <your app-specific password>"
        echo "  APPLE_TEAM_ID: $APPLE_TEAM_ID"
        echo "  KEYCHAIN_PASSWORD: <any secure password>"
        
        # Save base64 to file (it's too long for terminal)
        echo "$BASE64_CERT" > "$HOME/Desktop/macos-certificate-base64.txt"
        echo ""
        echo "✅ Base64 certificate saved to: $HOME/Desktop/macos-certificate-base64.txt"
    else
        echo "❌ Failed to export certificate"
    fi
fi

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "For LOCAL builds, add to your shell profile (~/.zshrc or ~/.bash_profile):"
echo ""
echo "  export APPLE_ID=\"$APPLE_ID\""
echo "  export APPLE_APP_SPECIFIC_PASSWORD=\"<your-app-specific-password>\""
echo "  export APPLE_TEAM_ID=\"$APPLE_TEAM_ID\""
echo ""
echo "Then run: npm run build:mac"
