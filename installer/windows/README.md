# Options Scanner - Windows Installation Guide

## Quick Installation

### Prerequisites
1. **Docker Desktop for Windows** - [Download here](https://www.docker.com/products/docker-desktop/)
   - Install Docker Desktop
   - Start Docker Desktop and wait for it to fully initialize
   - Ensure WSL 2 is enabled (Docker will prompt you if needed)

### Installation Steps

1. **Download** the Options Scanner package
2. **Extract** the ZIP file to a location of your choice
3. **Run** `installer\windows\install.bat` as Administrator (right-click → Run as administrator)
4. **Follow** the on-screen instructions
5. **Wait** for Docker to build the images (first time only, ~2-5 minutes)

### After Installation

- **Start**: Double-click "Options Scanner" on your desktop
- **Stop**: Double-click "Stop Options Scanner" on your desktop
- **Access**: Open http://localhost:8000 in your browser

---

## Manual Installation (Alternative)

If you prefer to install manually without the installer:

### Step 1: Install Prerequisites

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop and wait for the whale icon to appear in the system tray

### Step 2: Download and Extract

1. Download the Options Scanner ZIP file
2. Extract to `C:\OptionsScanner` (or your preferred location)

### Step 3: Build and Run

Open Command Prompt or PowerShell in the extracted folder and run:

```batch
# Build the application
docker-compose build

# Start the application
docker-compose up -d

# View logs (optional)
docker-compose logs -f
```

### Step 4: Access the Application

Open your browser and go to: **http://localhost:8000**

---

## Usage Commands

```batch
# Start the application
docker-compose up -d

# Stop the application
docker-compose down

# View logs
docker-compose logs -f

# Restart the application
docker-compose restart

# Check status
docker-compose ps

# Rebuild after updates
docker-compose build --no-cache
docker-compose up -d
```

---

## Troubleshooting

### Docker is not running
- Open Docker Desktop from the Start menu
- Wait for the whale icon to appear in the system tray
- Try the installation again

### Port 8000 is already in use
Edit `docker-compose.yml` and change the port:
```yaml
ports:
  - "8080:8000"  # Change 8000 to another port like 8080
```
Then access the app at http://localhost:8080

### Build fails
1. Ensure Docker Desktop is fully started
2. Check your internet connection
3. Try running: `docker system prune -a` to clean up
4. Rebuild: `docker-compose build --no-cache`

### Application not loading
1. Check container status: `docker-compose ps`
2. View logs: `docker-compose logs`
3. Wait 30-60 seconds after starting for full initialization

### MongoDB connection issues
The application uses MongoDB for paper trading. If you see database errors:
```batch
# Restart everything including MongoDB
docker-compose down -v
docker-compose up -d
```

---

## Uninstallation

### Using the Uninstaller
Run `uninstall.bat` in the installation directory.

### Manual Uninstallation
```batch
# Stop and remove containers
cd C:\OptionsScanner
docker-compose down -v

# Remove Docker images
docker rmi options-scanner_option-scanner

# Delete the installation folder
rmdir /s /q C:\OptionsScanner

# Delete desktop shortcuts manually
```

---

## System Requirements

- **OS**: Windows 10/11 (64-bit) with WSL 2
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB for Docker images
- **CPU**: 2 cores minimum
- **Network**: Internet connection for initial setup

---

## Support

For issues and feature requests, please check the application documentation or contact support.

## Features

- Real-time SPX and stock quotes
- Options chain analysis with Greeks
- Strategy scanners (Credit Spreads, Iron Condors, Iron Butterflies, Straddles, Strangles, Calendar Spreads)
- Paper trading portfolio with P/L tracking
- Auto take-profit and stop-loss functionality
- Position sizing calculator
- CSV export functionality
- Interactive P/L charts
