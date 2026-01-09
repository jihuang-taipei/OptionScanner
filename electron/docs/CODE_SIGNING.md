# Code Signing Guide for Options Scanner

This guide covers code signing setup for Windows, macOS, and Linux distributions.

## Why Code Sign?

| Platform | Without Signing | With Signing |
|----------|-----------------|--------------|
| Windows | "Unknown Publisher" warning, SmartScreen blocks | Trusted publisher, no warnings |
| macOS | "App cannot be opened" error, Gatekeeper blocks | Opens normally, notarized |
| Linux | No major issues | Package authenticity verified |

---

## Windows Code Signing

### Step 1: Obtain a Code Signing Certificate

**Options:**
1. **Standard OV Certificate** (~$200-500/year)
   - [DigiCert](https://www.digicert.com/signing/code-signing-certificates)
   - [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing)
   - [GlobalSign](https://www.globalsign.com/en/code-signing-certificate)

2. **EV Certificate** (~$300-600/year) - Recommended
   - Immediate SmartScreen reputation
   - Hardware token required
   - Same vendors as above

3. **Azure SignTool** (for CI/CD)
   - Stores certificate in Azure Key Vault
   - No local certificate file needed

### Step 2: Export Certificate

```powershell
# Export from Windows Certificate Store to PFX
$cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*Your Company*" }
$password = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "certificate.pfx" -Password $password
```

### Step 3: Configure Environment Variables

```bash
# For local builds
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="your-password"

# For CI/CD (base64 encoded certificate)
export WIN_CSC_LINK="base64-encoded-certificate"
export WIN_CSC_KEY_PASSWORD="your-password"
```

### Step 4: Build with Signing

```bash
cd electron
npm run build:win
```

---

## macOS Code Signing & Notarization

### Step 1: Join Apple Developer Program

1. Go to [developer.apple.com](https://developer.apple.com/programs/)
2. Enroll ($99/year for individuals, $299/year for organizations)

### Step 2: Create Certificates

1. Open **Xcode** → Preferences → Accounts
2. Click your Apple ID → Manage Certificates
3. Create:
   - **Developer ID Application** - For signing the app
   - **Developer ID Installer** - For signing PKG installers

Or use command line:
```bash
# List existing certificates
security find-identity -v -p codesigning

# The output shows certificates like:
# "Developer ID Application: Your Name (TEAMID)"
```

### Step 3: Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign In → Security → App-Specific Passwords
3. Generate a new password for "electron-notarize"

### Step 4: Configure Environment Variables

```bash
# Apple ID credentials for notarization
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

# Or use API key (recommended for CI/CD)
export APPLE_API_KEY="AuthKey_XXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 5: Build with Signing & Notarization

```bash
cd electron
npm run build:mac
```

The build process will:
1. Sign the app with Developer ID
2. Submit to Apple for notarization
3. Staple the notarization ticket

---

## Linux Code Signing

### GPG Signing for DEB/RPM Packages

### Step 1: Create GPG Key

```bash
# Generate a new GPG key
gpg --full-generate-key

# Choose:
# - RSA and RSA
# - 4096 bits
# - Key doesn't expire (or set expiration)
# - Your name and email
# - Strong passphrase
```

### Step 2: Export Public Key

```bash
# List keys
gpg --list-secret-keys --keyid-format LONG

# Export public key
gpg --armor --export YOUR_KEY_ID > public-key.asc

# Upload to keyserver (optional)
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

### Step 3: Sign Packages

```bash
# Sign DEB package
dpkg-sig --sign builder options-scanner_1.0.0_amd64.deb

# Sign RPM package
rpm --addsign options-scanner-1.0.0.x86_64.rpm
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd frontend && npm ci && npm run build
          cd ../electron && npm ci
      
      - name: Build Windows
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
        run: cd electron && npm run build:win
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: electron/dist/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install certificates
        env:
          MACOS_CERTIFICATE: ${{ secrets.MACOS_CERTIFICATE }}
          MACOS_CERTIFICATE_PWD: ${{ secrets.MACOS_CERTIFICATE_PWD }}
        run: |
          echo $MACOS_CERTIFICATE | base64 --decode > certificate.p12
          security create-keychain -p actions build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p actions build.keychain
          security import certificate.p12 -k build.keychain -P $MACOS_CERTIFICATE_PWD -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions build.keychain
      
      - name: Install dependencies
        run: |
          cd frontend && npm ci && npm run build
          cd ../electron && npm ci
      
      - name: Build macOS
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: cd electron && npm run build:mac
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-build
          path: |
            electron/dist/*.dmg
            electron/dist/*.zip

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd frontend && npm ci && npm run build
          cd ../electron && npm ci
      
      - name: Build Linux
        run: cd electron && npm run build:linux
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-build
          path: |
            electron/dist/*.AppImage
            electron/dist/*.deb
            electron/dist/*.rpm

  release:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            windows-build/*
            macos-build/*
            linux-build/*
          draft: true
          generate_release_notes: true
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `WIN_CSC_LINK` | Base64-encoded Windows certificate (.pfx) |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password |
| `MACOS_CERTIFICATE` | Base64-encoded macOS certificate (.p12) |
| `MACOS_CERTIFICATE_PWD` | macOS certificate password |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

### Encode Certificate for Secrets

```bash
# Windows
base64 -i certificate.pfx | tr -d '\n' > certificate-base64.txt

# macOS
base64 -i Certificates.p12 | tr -d '\n' > certificate-base64.txt
```

---

## Verification

### Windows
```powershell
# Verify signature
Get-AuthenticodeSignature "Options Scanner-1.0.0-win-x64.exe"
```

### macOS
```bash
# Verify signature
codesign --verify --deep --strict "Options Scanner.app"

# Verify notarization
spctl --assess --type execute "Options Scanner.app"
```

### Linux
```bash
# Verify DEB signature
dpkg-sig --verify options-scanner_1.0.0_amd64.deb

# Verify RPM signature
rpm --checksig options-scanner-1.0.0.x86_64.rpm
```

---

## Troubleshooting

### Windows: "Windows protected your PC"
- Ensure certificate is valid and not expired
- EV certificates get instant reputation
- OV certificates need time to build reputation

### macOS: "App is damaged"
- Run: `xattr -cr "Options Scanner.app"`
- Ensure notarization completed successfully
- Check entitlements are correct

### macOS: Notarization fails
- Check Apple ID credentials
- Ensure hardened runtime is enabled
- Review entitlements in `entitlements.mac.plist`

---

## Cost Summary

| Platform | Certificate Type | Annual Cost |
|----------|-----------------|-------------|
| Windows | OV Certificate | $200-500 |
| Windows | EV Certificate | $300-600 |
| macOS | Apple Developer Program | $99-299 |
| Linux | GPG Key | Free |

**Total (minimum):** ~$300/year for basic signing
**Total (recommended):** ~$700/year for EV + Apple Developer
