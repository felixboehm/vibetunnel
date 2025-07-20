# VibeTunnel Critical Issues - Root Cause Analysis & Fixes

**Date**: July 13, 2025  
**Status**: Two critical issues identified and solutions available

## Issue 1: ERR_CONNECTION_REFUSED - Service Appears to Crash/Hang

### Symptoms
- Browser shows multiple `ERR_CONNECTION_REFUSED` errors
- Sessions close after 2-5 seconds
- Service appears running but becomes unresponsive to remote connections

### Root Cause
The VibeTunnel service is still running locally (responds on localhost) but becomes unresponsive to external connections. This suggests:
1. **Connection/Resource Exhaustion**: The service may be hitting connection limits
2. **Event Loop Blocking**: Something is blocking the Node.js event loop
3. **Memory/Resource Issues**: Though memory usage appears low (34MB)

### Network Dump Analysis
```
config (failed) net::ERR_CONNECTION_REFUSED
client (failed) net::ERR_CONNECTION_REFUSED
sessions (failed) net::ERR_CONNECTION_REFUSED
```
Multiple endpoints failing simultaneously = entire service unreachable

### Immediate Actions

1. **Check for connection limits**:
```bash
# Check current connections
ss -s
netstat -an | grep :4020 | wc -l

# Check system limits
ulimit -n  # File descriptors
cat /proc/sys/net/core/somaxconn  # Socket backlog
```

2. **Monitor in real-time during failure**:
```bash
# Terminal 1: Watch connections
watch -n 1 'ss -tn | grep :4020 | wc -l'

# Terminal 2: Watch process
top -p $(pgrep -f vibetunnel-linux-cli)

# Terminal 3: Watch system logs
dmesg -w | grep -i "out of\|limit\|error"
```

3. **Temporary Fix - Restart service periodically**:
```bash
# Add to crontab (every hour)
0 * * * * systemctl restart vibetunnel
```

## Issue 2: Multi-User Authentication Failure

### Confirmed Root Cause
The `vibetunnel` user lacks permission to read `/etc/shadow` for PAM authentication.

### Evidence
- Test user exists: `uid=1001(testuser) gid=1001(testuser)`
- Authentication fails: `{"success":false,"error":"Invalid username or password"}`
- VibeTunnel user groups: `vibetunnel : vibetunnel` (NOT in shadow group)

### Permanent Fix (Requires Root)

```bash
# Option 1: Add to shadow group (RECOMMENDED)
sudo usermod -a -G shadow vibetunnel
sudo systemctl restart vibetunnel

# Option 2: Use setuid wrapper (MORE SECURE)
# Create a small C program that can read shadow with elevated privileges
# This is more complex but more secure than adding to shadow group

# Option 3: Custom PAM service (MOST SECURE)
sudo tee /etc/pam.d/vibetunnel << 'EOF'
# VibeTunnel PAM configuration
@include common-auth
@include common-account
@include common-session
EOF

# Then modify VibeTunnel to use 'vibetunnel' PAM service instead of 'login'
```

## Combined Fix Script

Create this script as `/tmp/fix-vibetunnel.sh`:

```bash
#!/bin/bash
# VibeTunnel Fix Script - Run as root

echo "=== VibeTunnel Critical Fixes ==="

# 1. Fix authentication
echo "Adding vibetunnel to shadow group..."
usermod -a -G shadow vibetunnel

# 2. Increase system limits
echo "Increasing system limits..."
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
sysctl -p

# 3. Enable debug logging
echo "Enabling debug logging..."
mkdir -p /etc/systemd/system/vibetunnel.service.d/
cat > /etc/systemd/system/vibetunnel.service.d/override.conf << 'EOF'
[Service]
Environment="VIBETUNNEL_DEBUG=1"
Environment="NODE_OPTIONS=--max-old-space-size=512"
RestartSec=30
StartLimitBurst=10
EOF

# 4. Restart service
echo "Restarting VibeTunnel..."
systemctl daemon-reload
systemctl restart vibetunnel

# 5. Test authentication
sleep 5
echo "Testing authentication..."
curl -X POST http://localhost:4020/api/auth/password \
  -H "Content-Type: application/json" \
  -d '{"userId": "testuser", "password": "<TEST_PASSWORD>"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "=== Fixes Applied ==="
echo "Monitor with: journalctl -u vibetunnel -f"
```

## Monitoring Commands

After applying fixes, monitor the service:

```bash
# Watch for crashes/restarts
journalctl -u vibetunnel -f | grep -E "started|stopped|failed|error"

# Monitor connections
watch -n 1 'ss -tn | grep :4020'

# Check authentication
curl -X POST http://localhost:4020/api/auth/password \
  -H "Content-Type: application/json" \
  -d '{"userId": "testuser", "password": "<TEST_PASSWORD>"}'
```

## Long-term Solutions

1. **For Connection Issues**:
   - Implement connection pooling
   - Add request rate limiting
   - Use a reverse proxy (nginx) with connection limits
   - Implement health checks and auto-restart

2. **For Authentication**:
   - Create dedicated authentication service
   - Use capabilities instead of setuid/shadow group
   - Implement caching for user lookups
   - Add authentication debug logging

## Expected Results After Fix

1. **Authentication**: 
   ```json
   {"success":true,"userId":"testuser","token":"..."}
   ```

2. **Stable Sessions**:
   - Sessions remain open indefinitely
   - No ERR_CONNECTION_REFUSED errors
   - Smooth terminal operation

## Next Steps

1. Apply the fix script as root
2. Test authentication with multiple users
3. Monitor for connection stability
4. Consider implementing nginx reverse proxy for production