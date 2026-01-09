# Options Scanner - macOS Installation Guide

## Quick Installation

### Prerequisites
1. **Docker Desktop for Mac** - [Download here](https://www.docker.com/products/docker-desktop/)
   - Download the appropriate version (Intel or Apple Silicon)
   - Install by dragging to Applications
   - Start Docker Desktop and wait for the whale icon in the menu bar

### Installation

1. Open Terminal
2. Navigate to the Options Scanner folder:
   ```bash
   cd /path/to/OptionsScanner
   ```
3. Run the installer:
   ```bash
   chmod +x installer/macos/install.sh
   ./installer/macos/install.sh
   ```
4. Follow the on-screen instructions

### After Installation

- **Start**: Open "Options Scanner" from Applications, or run `~/OptionsScanner/start.sh`
- **Stop**: Run `~/OptionsScanner/stop.sh`
- **Logs**: Run `~/OptionsScanner/logs.sh`
- **Access**: Open http://localhost:8000 in your browser

---

## Manual Installation

```bash
# Navigate to the app folder
cd /path/to/OptionsScanner

# Build and start
docker-compose up -d

# Open browser
open http://localhost:8000
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `start.sh` | Start the application |
| `stop.sh` | Stop the application |
| `logs.sh` | View live application logs |
| `status.sh` | Check container status |
| `uninstall.sh` | Remove the application |

---

## Troubleshooting

### Docker not running
```bash
# Start Docker Desktop from Applications
open -a Docker
# Wait for the whale icon to appear in the menu bar
```

### Permission denied
```bash
chmod +x installer/macos/install.sh
chmod +x *.sh
```

### Port 8000 in use
Edit `docker-compose.yml` and change the port:
```yaml
ports:
  - "8080:8000"
```

### Clean rebuild
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## Uninstallation

```bash
~/OptionsScanner/uninstall.sh
```

Or manually:
```bash
cd ~/OptionsScanner
docker-compose down -v
docker rmi optionsscanner-option-scanner
rm -rf ~/OptionsScanner
rm -rf "/Applications/Options Scanner.app"
```
