# Options Scanner - Electron Desktop App

## Overview

This is the Electron wrapper for Options Scanner, providing a native desktop application experience with:

- **Auto-updates** - Automatic update checking and installation
- **System tray** - Minimize to tray, background operation
- **Native menus** - Platform-specific menus and shortcuts
- **Docker management** - Automatic backend startup/shutdown

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Docker Desktop** - Required for the backend
3. **Git** (optional) - For cloning the repository

## Development

### Setup

```bash
cd electron
npm install
```

### Run in Development

```bash
# Make sure backend is built first
cd ..
docker-compose build

# Run Electron in dev mode
cd electron
npm run dev
```

### Build for Production

```bash
# Build frontend first
cd ../frontend
npm run build

# Build Electron app
cd ../electron
npm run build        # Current platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
npm run build:all    # All platforms
```

## Distribution

Built applications are output to `electron/dist/`:

### Windows
- `Options Scanner-x.x.x-win-x64.exe` - NSIS installer
- `Options Scanner-x.x.x-win-x64-portable.exe` - Portable version

### macOS
- `Options Scanner-x.x.x-mac-x64.dmg` - Intel DMG
- `Options Scanner-x.x.x-mac-arm64.dmg` - Apple Silicon DMG

### Linux
- `Options Scanner-x.x.x-linux-x64.AppImage` - AppImage
- `options-scanner_x.x.x_amd64.deb` - Debian package
- `options-scanner-x.x.x.x86_64.rpm` - RPM package

## Auto-Update

The app uses `electron-updater` for automatic updates. To enable:

1. **Set up GitHub releases** - Configure your repository in `package.json`
2. **Create a release** - Tag and publish a GitHub release
3. **Build and upload** - Run build and upload artifacts to the release

### Update Flow

1. App checks for updates on startup and periodically
2. If update available, user is prompted to download
3. Update downloads in background
4. User prompted to restart when ready
5. App restarts with new version

### Configuration

Update settings are stored in the app's user data directory:

```json
{
  "autoUpdate": true,
  "checkUpdateInterval": 3600000
}
```

## Project Structure

```
electron/
├── package.json         # Electron dependencies and build config
├── src/
│   ├── main.js         # Main process
│   ├── preload.js      # Preload script (IPC bridge)
│   ├── loading.html    # Loading screen
│   └── settings.html   # Settings window
├── assets/
│   ├── icon.ico        # Windows icon
│   ├── icon.icns       # macOS icon
│   ├── icon.png        # Linux icon
│   ├── tray-icon.png   # System tray icon
│   └── entitlements.mac.plist
├── scripts/
│   └── check-updates.js
└── dist/               # Build output
```

## Icons

Replace placeholder icons in `assets/`:

- `icon.ico` - Windows (256x256, ICO format)
- `icon.icns` - macOS (512x512, ICNS format)
- `icon.png` - Linux (512x512, PNG format)
- `tray-icon.png` - System tray (22x22 or 16x16, PNG format)

### Creating Icons

Use tools like:
- [electron-icon-builder](https://github.com/nicennnnnnnlee/electron-icon-builder)
- [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (macOS)
- [ImageMagick](https://imagemagick.org/)

## Code Signing

### Windows

1. Obtain a code signing certificate
2. Set environment variables:
   ```
   CSC_LINK=path/to/certificate.pfx
   CSC_KEY_PASSWORD=your-password
   ```

### macOS

1. Join Apple Developer Program
2. Create signing certificates in Xcode
3. Set environment variables:
   ```
   APPLE_ID=your@apple.id
   APPLE_ID_PASS=app-specific-password
   ```

## Troubleshooting

### App won't start
- Ensure Docker Desktop is running
- Check logs: Help → View Logs

### Updates not working
- Check GitHub release configuration
- Verify version number format (semver)
- Check network connectivity

### Build fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear dist: `rm -rf dist`
- Update electron-builder: `npm update electron-builder`
