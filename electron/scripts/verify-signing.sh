#!/bin/bash

# Verify Code Signing Script
# Verifies that built applications are properly signed

set -e

echo "============================================"
echo "   Code Signing Verification"
echo "============================================"
echo ""

DIST_DIR="$(dirname "$0")/../dist"

if [ ! -d "$DIST_DIR" ]; then
    echo "Error: dist directory not found. Run build first."
    exit 1
fi

echo "Checking: $DIST_DIR"
echo ""

# ============================================
# Windows Verification
# ============================================
verify_windows() {
    echo "=== Windows Verification ==="
    echo ""
    
    WIN_FILES=$(find "$DIST_DIR" -name "*.exe" 2>/dev/null)
    
    if [ -z "$WIN_FILES" ]; then
        echo "No Windows executables found"
        return
    fi
    
    for file in $WIN_FILES; do
        echo "File: $(basename "$file")"
        
        if command -v osslsigncode &> /dev/null; then
            # Linux/macOS with osslsigncode
            RESULT=$(osslsigncode verify "$file" 2>&1 || true)
            if echo "$RESULT" | grep -q "Signature verification: ok"; then
                echo "  ✅ Signature: VALID"
                echo "$RESULT" | grep "Signer" | head -1 | sed 's/^/  /'
            else
                echo "  ❌ Signature: NOT SIGNED or INVALID"
            fi
        elif command -v powershell &> /dev/null; then
            # Windows PowerShell
            RESULT=$(powershell -Command "Get-AuthenticodeSignature '$file' | Select-Object -ExpandProperty Status" 2>&1)
            if [ "$RESULT" = "Valid" ]; then
                echo "  ✅ Signature: VALID"
                powershell -Command "Get-AuthenticodeSignature '$file' | Select-Object -ExpandProperty SignerCertificate | Select-Object -ExpandProperty Subject" | sed 's/^/  /'
            else
                echo "  ❌ Signature: $RESULT"
            fi
        else
            echo "  ⚠️  Cannot verify (install osslsigncode or run on Windows)"
        fi
        echo ""
    done
}

# ============================================
# macOS Verification
# ============================================
verify_macos() {
    echo "=== macOS Verification ==="
    echo ""
    
    # Check .app bundles
    APP_FILES=$(find "$DIST_DIR" -name "*.app" -type d 2>/dev/null)
    DMG_FILES=$(find "$DIST_DIR" -name "*.dmg" 2>/dev/null)
    
    if [ -z "$APP_FILES" ] && [ -z "$DMG_FILES" ]; then
        echo "No macOS applications found"
        return
    fi
    
    if [[ "$(uname)" != "Darwin" ]]; then
        echo "⚠️  macOS verification requires running on macOS"
        echo "Found files:"
        [ -n "$APP_FILES" ] && echo "$APP_FILES" | sed 's/^/  /'
        [ -n "$DMG_FILES" ] && echo "$DMG_FILES" | sed 's/^/  /'
        return
    fi
    
    # Verify .app bundles
    for app in $APP_FILES; do
        echo "App: $(basename "$app")"
        
        # Check code signature
        if codesign --verify --deep --strict "$app" 2>/dev/null; then
            echo "  ✅ Code Signature: VALID"
            codesign -dvv "$app" 2>&1 | grep "Authority" | head -1 | sed 's/^/  /'
        else
            echo "  ❌ Code Signature: INVALID or NOT SIGNED"
        fi
        
        # Check notarization
        if spctl --assess --type execute "$app" 2>/dev/null; then
            echo "  ✅ Notarization: VALID (Gatekeeper approved)"
        else
            echo "  ⚠️  Notarization: Not verified (may not be notarized)"
        fi
        echo ""
    done
    
    # Verify DMG files
    for dmg in $DMG_FILES; do
        echo "DMG: $(basename "$dmg")"
        
        if codesign --verify "$dmg" 2>/dev/null; then
            echo "  ✅ Code Signature: VALID"
        else
            echo "  ⚠️  DMG not signed (optional)"
        fi
        
        # Check notarization via stapler
        if xcrun stapler validate "$dmg" 2>/dev/null; then
            echo "  ✅ Notarization: STAPLED"
        else
            echo "  ⚠️  Notarization ticket not stapled"
        fi
        echo ""
    done
}

# ============================================
# Linux Verification
# ============================================
verify_linux() {
    echo "=== Linux Verification ==="
    echo ""
    
    DEB_FILES=$(find "$DIST_DIR" -name "*.deb" 2>/dev/null)
    RPM_FILES=$(find "$DIST_DIR" -name "*.rpm" 2>/dev/null)
    APPIMAGE_FILES=$(find "$DIST_DIR" -name "*.AppImage" 2>/dev/null)
    
    if [ -z "$DEB_FILES" ] && [ -z "$RPM_FILES" ] && [ -z "$APPIMAGE_FILES" ]; then
        echo "No Linux packages found"
        return
    fi
    
    # Verify DEB packages
    for deb in $DEB_FILES; do
        echo "DEB: $(basename "$deb")"
        
        if command -v dpkg-sig &> /dev/null; then
            if dpkg-sig --verify "$deb" 2>/dev/null; then
                echo "  ✅ GPG Signature: VALID"
            else
                echo "  ⚠️  GPG Signature: NOT SIGNED"
            fi
        else
            echo "  ⚠️  Cannot verify (install dpkg-sig)"
        fi
        echo ""
    done
    
    # Verify RPM packages
    for rpm_file in $RPM_FILES; do
        echo "RPM: $(basename "$rpm_file")"
        
        if command -v rpm &> /dev/null; then
            if rpm --checksig "$rpm_file" 2>/dev/null | grep -q "OK"; then
                echo "  ✅ GPG Signature: VALID"
            else
                echo "  ⚠️  GPG Signature: NOT SIGNED"
            fi
        else
            echo "  ⚠️  Cannot verify (install rpm)"
        fi
        echo ""
    done
    
    # List AppImage files
    for appimage in $APPIMAGE_FILES; do
        echo "AppImage: $(basename "$appimage")"
        echo "  ℹ️  AppImages are self-contained, signature optional"
        echo ""
    done
}

# ============================================
# Summary
# ============================================
generate_summary() {
    echo "=== Build Summary ==="
    echo ""
    
    echo "Files in dist/:"
    find "$DIST_DIR" -maxdepth 1 -type f \( -name "*.exe" -o -name "*.dmg" -o -name "*.zip" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" \) -exec basename {} \; 2>/dev/null | sort | sed 's/^/  /'
    
    echo ""
    echo "Total size:"
    du -sh "$DIST_DIR" 2>/dev/null | cut -f1 | sed 's/^/  /'
}

# Run verifications
verify_windows
verify_macos
verify_linux
generate_summary

echo ""
echo "============================================"
echo "   Verification Complete"
echo "============================================"
