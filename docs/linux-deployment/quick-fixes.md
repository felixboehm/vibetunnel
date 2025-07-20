# VibeTunnel Quick Fixes Guide

**Purpose**: Immediate actions to resolve current issues  
**Target**: System administrators with root access

## 🚨 Critical Issues & Quick Fixes

### 1. Fix Multi-user Authentication

**Problem**: Only `vibetunnel` user can login, other users fail PAM authentication.

**Quick Fix** (run as root):
```bash
# Option 1: Add vibetunnel to shadow group (allows reading /etc/shadow)
sudo usermod -a -G shadow vibetunnel
sudo systemctl restart vibetunnel

# Option 2: Create custom PAM configuration
sudo tee /etc/pam.d/vibetunnel << 'EOF'
# PAM configuration for VibeTunnel
auth    required     pam_unix.so nodelay
account required     pam_unix.so
EOF

# Set proper permissions
sudo chmod 644 /etc/pam.d/vibetunnel
sudo systemctl restart vibetunnel
```

**Test**:
```bash
# Create test user
sudo useradd -m -s /bin/bash testuser
echo "testuser:<TEST_PASSWORD>" | sudo chpasswd

# Try logging in at http://<YOUR_SERVER_IP>:4020
# Username: testuser
# Password: <TEST_PASSWORD>
```

### 2. Debug Session Closing Issue

**Problem**: Sessions close after 2-5 seconds automatically.

**Diagnostic Steps**:
```bash
# 1. Check server resources
free -h
df -h
htop

# 2. Monitor VibeTunnel logs in real-time
sudo journalctl -u vibetunnel -f

# 3. Check for permission issues
ls -la /opt/vibetunnel/vibetunnel/web/
ls -la /home/vibetunnel/.vibetunnel/

# 4. Test with simple command
# In VibeTunnel web interface, create new session with:
/bin/bash -c "while true; do echo 'alive'; sleep 5; done"
```

**Temporary Workaround**:
```bash
# Restart the service (sometimes helps with stuck processes)
sudo systemctl restart vibetunnel

# Check for zombie processes
ps aux | grep defunct
```

### 3. Enable Debug Logging

**Add debug logging to identify issues**:
```bash
# Edit systemd service
sudo systemctl edit vibetunnel

# Add these lines in the [Service] section:
[Service]
Environment=VIBETUNNEL_DEBUG=1
Environment=NODE_ENV=development

# Restart service
sudo systemctl daemon-reload
sudo systemctl restart vibetunnel

# Watch detailed logs
sudo journalctl -u vibetunnel -f
```

## 🔧 Configuration Checks

### Verify Current Setup
```bash
# Check service status
sudo systemctl status vibetunnel

# Check environment variables (should NOT see VIBETUNNEL_USERNAME)
sudo cat /proc/$(pgrep -f vibetunnel-linux-cli)/environ | tr '\0' '\n' | grep VIBETUNNEL

# Check PAM module
find /opt/vibetunnel -name "authenticate_pam.node" -ls

# Check user permissions
id vibetunnel
groups vibetunnel
```

### Network Diagnostics
```bash
# Check if port is accessible
curl -I http://localhost:4020

# Check active connections
ss -tulpn | grep 4020

# Test WebSocket upgrade
curl -i -N -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: <WEBSOCKET_KEY>" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:4020/
```

## 🎯 Testing Checklist

After applying fixes:

- [ ] Create test user with password
- [ ] Test login with test user credentials
- [ ] Create a new terminal session
- [ ] Verify session stays open > 30 seconds
- [ ] Run commands in the terminal
- [ ] Check file browser functionality
- [ ] Test session reconnection (refresh page)

## 💡 If Issues Persist

1. **Collect Diagnostics**:
   ```bash
   # Create diagnostic bundle
   mkdir /tmp/vibetunnel-diag
   sudo journalctl -u vibetunnel -n 1000 > /tmp/vibetunnel-diag/service.log
   sudo cp /etc/systemd/system/vibetunnel.service /tmp/vibetunnel-diag/
   ps aux > /tmp/vibetunnel-diag/processes.txt
   free -h > /tmp/vibetunnel-diag/memory.txt
   df -h > /tmp/vibetunnel-diag/disk.txt
   tar -czf vibetunnel-diagnostics.tar.gz /tmp/vibetunnel-diag/
   ```

2. **Try Alternative Installation**:
   ```bash
   # Stop current service
   sudo systemctl stop vibetunnel
   
   # Run manually with debug output
   cd /opt/vibetunnel/vibetunnel/web
   sudo -u vibetunnel VIBETUNNEL_DEBUG=1 node dist/vibetunnel-linux-cli --enable-ssh-keys
   ```

3. **Check Browser Console**:
   - Press F12 in browser
   - Go to Console tab
   - Look for red errors
   - Check Network tab for failed requests

## 📝 Notes

- The PAM authentication issue is likely due to the `vibetunnel` user not having permission to read `/etc/shadow`
- Session closing might be related to SSE (Server-Sent Events) connection stability
- No environment variables should override PAM (verified: VIBETUNNEL_USERNAME is not set)
- The system is designed to support multi-user authentication when properly configured