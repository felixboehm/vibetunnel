# VibeTunnel Linux Server

A standalone Linux server deployment of VibeTunnel, providing web-based terminal access without requiring the macOS desktop application.

## Quick Start

### Hetzner Cloud Setup

1. **Create Server:**
   ```bash
   # Create ARM-based server (recommended for VibeTunnel)
   hcloud server create --image ubuntu-22.04 --type cax21 --name vibetunnel-server --ssh-key <your-key> --location nbg1
   ```

2. **SSH into server:**
   ```bash
   ssh root@<server-ip>
   ```

### Server Installation

Run the automated setup script:

```bash
curl -fsSL https://raw.githubusercontent.com/felixboehm/vibetunnel/main/scripts/install-linux.sh | bash
```

Or install manually:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install build tools
apt install -y build-essential unzip curl git

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Clone and build VibeTunnel
git clone https://github.com/felixboehm/vibetunnel.git
cd vibetunnel/web
npm install
npm run build

# Install as system service
sudo cp dist/vibetunnel-cli /usr/local/bin/vibetunnel
sudo chmod +x /usr/local/bin/vibetunnel
```

### Start the Server

```bash
# Start directly
vibetunnel

# Or with custom port
PORT=8080 vibetunnel

# Run with debug logging
VIBETUNNEL_DEBUG=1 vibetunnel
```

The server will be available at `http://your-server-ip:4020`

## Configuration

### Environment Variables

- `PORT` - Server port (default: 4020)
- `HOST` - Bind address (default: 0.0.0.0)
- `VIBETUNNEL_DEBUG` - Enable debug logging (1 or true)
- `NO_AUTH` - Disable authentication (for development only)

### Systemd Service

Create `/etc/systemd/system/vibetunnel.service`:

```ini
[Unit]
Description=VibeTunnel Web Terminal Server
After=network.target

[Service]
Type=simple
User=vibetunnel
Group=vibetunnel
WorkingDirectory=/opt/vibetunnel
ExecStart=/usr/local/bin/vibetunnel
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=4020

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable vibetunnel
sudo systemctl start vibetunnel
sudo systemctl status vibetunnel
```

## Security Considerations

### Firewall Configuration

```bash
# Allow SSH and VibeTunnel port
ufw allow 22
ufw allow 4020
ufw enable
```

### SSL/TLS (Recommended)

Use a reverse proxy like nginx:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:4020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Authentication

VibeTunnel includes built-in authentication. For additional security:

1. Use strong passwords
2. Consider VPN access
3. Implement fail2ban for SSH protection
4. Regular security updates

## Features

### Terminal Sessions
- Multiple concurrent terminal sessions
- Session persistence and reconnection
- Real-time terminal sharing
- File upload/download
- Terminal recording (asciinema format)

### File Management
- Built-in file browser
- Code editor with syntax highlighting
- File upload/download
- Directory navigation

### System Integration
- Process monitoring
- System logs viewing
- Git integration
- Multiple shell support (bash, zsh, fish)

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 4020
sudo lsof -i :4020
# Kill process if needed
sudo kill -9 <PID>
```

**Permission errors:**
```bash
# Ensure proper permissions
sudo chown -R vibetunnel:vibetunnel /opt/vibetunnel
```

**Node.js compatibility:**
```bash
# Check Node.js version (requires 20+)
node --version
```

### Logs

```bash
# View systemd logs
sudo journalctl -u vibetunnel -f

# Direct server logs
VIBETUNNEL_DEBUG=1 vibetunnel
```

## Development

### Local Development

```bash
cd vibetunnel/web
npm install
npm run dev
```

Server runs on `http://localhost:4020` with hot reload.

### Building from Source

```bash
cd vibetunnel/web
npm install
npm run build
```

## Cost Estimation

### Hetzner Cloud Pricing (Monthly)
- **cax11** (2 cores, 4GB RAM): ~€3.29/month
- **cax21** (4 cores, 8GB RAM): ~€6.19/month (recommended)
- **cpx11** (2 cores, 2GB RAM): ~€4.15/month

### Bandwidth
- 20TB included traffic per month
- Additional traffic: €1.19/TB

## Support

For issues and questions:
- GitHub Issues: https://github.com/felixboehm/vibetunnel/issues
- Original Project: https://github.com/amantus-ai/vibetunnel

## License

MIT License - see LICENSE file for details.