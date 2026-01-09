# Options Scanner - Linux Installation Guide

## Quick Installation

### Prerequisites

#### Docker Engine

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

**Fedora:**
```bash
sudo dnf install docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

**Arch Linux:**
```bash
sudo pacman -S docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

### Installation

1. Open Terminal
2. Navigate to the Options Scanner folder:
   ```bash
   cd /path/to/OptionsScanner
   ```
3. Run the installer:
   ```bash
   chmod +x installer/linux/install.sh
   ./installer/linux/install.sh
   ```
4. Follow the on-screen instructions

### After Installation

- **Start**: Search for "Options Scanner" in your app menu, or run `~/OptionsScanner/start.sh`
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
xdg-open http://localhost:8000
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

## Systemd Service (Optional)

To run Options Scanner as a system service:

```bash
sudo nano /etc/systemd/system/options-scanner.service
```

Add:
```ini
[Unit]
Description=Options Scanner
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USER/OptionsScanner
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=YOUR_USER
Group=docker

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable options-scanner
sudo systemctl start options-scanner
```

---

## Troubleshooting

### Docker permission denied
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Docker daemon not running
```bash
sudo systemctl start docker
sudo systemctl enable docker  # Start on boot
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

### SELinux issues (Fedora/RHEL)
```bash
sudo setsebool -P container_manage_cgroup on
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
rm -f ~/.local/share/applications/options-scanner*.desktop
```
