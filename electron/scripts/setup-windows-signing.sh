#!/bin/bash

# Windows Code Signing Setup Script
# Run this to prepare your Windows signing certificate

set -e

echo "============================================"
echo "   Windows Code Signing Setup"
echo "============================================"
echo ""

# Check if certificate exists
if [ -z "$1" ]; then
    echo "Usage: $0 <path-to-certificate.pfx>"
    echo ""
    echo "To export a certificate from Windows:"
    echo "  1. Open certmgr.msc"
    echo "  2. Navigate to Personal > Certificates"
    echo "  3. Right-click your code signing cert"
    echo "  4. All Tasks > Export..."
    echo "  5. Export with private key as .pfx"
    exit 1
fi

CERT_PATH="$1"

if [ ! -f "$CERT_PATH" ]; then
    echo "Error: Certificate file not found: $CERT_PATH"
    exit 1
fi

echo "Certificate found: $CERT_PATH"
echo ""

# Prompt for password
read -s -p "Enter certificate password: " CERT_PASSWORD
echo ""

# Verify certificate
echo "Verifying certificate..."
openssl pkcs12 -in "$CERT_PATH" -passin "pass:$CERT_PASSWORD" -noout 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Error: Invalid certificate or password"
    exit 1
fi

echo "[OK] Certificate is valid"
echo ""

# Get certificate info
echo "Certificate details:"
openssl pkcs12 -in "$CERT_PATH" -passin "pass:$CERT_PASSWORD" -nokeys 2>/dev/null | openssl x509 -noout -subject -dates
echo ""

# Base64 encode for CI/CD
echo "Encoding certificate for CI/CD..."
BASE64_CERT=$(base64 -w0 "$CERT_PATH" 2>/dev/null || base64 -i "$CERT_PATH" | tr -d '\n')

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "For LOCAL builds, add to your shell profile:"
echo ""
echo "  export CSC_LINK=\"$CERT_PATH\""
echo "  export CSC_KEY_PASSWORD=\"<your-password>\""
echo ""
echo "For CI/CD (GitHub Actions), add these secrets:"
echo ""
echo "  WIN_CSC_LINK: (base64 encoded certificate below)"
echo "  WIN_CSC_KEY_PASSWORD: <your-password>"
echo ""
echo "Base64 encoded certificate (save to WIN_CSC_LINK secret):"
echo "============================================"
echo "$BASE64_CERT"
echo "============================================"
