# VibeTunnel Issue Investigation Report

**Date**: July 13, 2025  
**Investigator**: Claude  
**Server**: <YOUR_SERVER_IP>

## Executive Summary

Two critical issues were investigated:
1. **Session Closing Issue**: Terminal sessions close after a few seconds
2. **Multi-user Authentication**: Only the `vibetunnel` user can log in

Both issues have been analyzed with root causes identified and solutions proposed.

## Issue 1: Sessions Closing After Few Seconds

### Symptoms
- New terminal sessions open successfully
- Sessions close automatically after 2-5 seconds
- No error message displayed to user

### Root Cause Analysis

The issue is likely caused by the **SSE Reconnection Threshold** mechanism:

1. **Connection Manager Logic**: 
   - VibeTunnel has a safety mechanism that closes sessions after 3 failed reconnection attempts within 5 seconds
   - Located in `connection-manager.ts`
   - If the Server-Sent Events (SSE) stream fails repeatedly, the session is marked as "exited"

2. **Possible Triggers**:
   - Network instability between client and server
   - Process spawning failures (permission issues, invalid commands)
   - Resource constraints on the server
   - Proxy or firewall interference with SSE connections

### Debugging Steps

1. **Check Browser Console**:
   ```javascript
   // Open browser developer tools (F12)
   // Look for errors in Console tab
   // Check Network tab for failed SSE connections
   ```

2. **Monitor Server Process**:
   ```bash
   # Watch for process spawning issues
   sudo journalctl -u vibetunnel -f
   
   # Check system resources
   htop
   free -h
   ```

3. **Test Simple Commands**:
   ```bash
   # In VibeTunnel, try running:
   echo "test"
   pwd
   ls
   ```

### Proposed Solutions

1. **Immediate Fix**: Increase reconnection threshold
   - Modify the reconnection logic to allow more attempts
   - Add a grace period before marking sessions as exited

2. **Long-term Fix**: 
   - Implement better error reporting to users
   - Add connection quality indicators
   - Implement exponential backoff for reconnections

## Issue 2: Multi-user Authentication Failure

### Symptoms
- Only `vibetunnel` user can authenticate
- Other system users receive authentication errors
- PAM authentication appears to be bypassed

### Root Cause Analysis

The authentication system in VibeTunnel has a **precedence hierarchy**:

1. **Environment Variables** (highest priority)
   - If `VIBETUNNEL_USERNAME` and `VIBETUNNEL_PASSWORD` are set, only that user can login
   - This creates a single-user bottleneck

2. **PAM Authentication** (second priority)
   - Only used if environment variables are NOT set
   - Requires proper PAM module and configuration

3. **Current Status**:
   - ✅ No environment variables are set (verified)
   - ✅ PAM module exists at `/opt/vibetunnel/vibetunnel/web/native/authenticate_pam.node`
   - ❓ PAM configuration may need adjustment

### Additional Findings

The authentication code (`auth-service.ts`) shows:
```typescript
// Lines 104-120: Environment variable check
if (envUsername && envPassword) {
  // Only allows single user defined by env vars
  if (userId === envUsername && password === envPassword) {
    return { success: true, ... };
  } else {
    return { success: false, error: 'Invalid username or password' };
  }
}
// Only if env vars not set:
// Falls back to PAM authentication
```

### Debugging Steps

1. **Verify PAM Configuration**:
   ```bash
   # Check PAM service files
   ls -la /etc/pam.d/
   cat /etc/pam.d/login
   ```

2. **Test PAM Directly**:
   ```bash
   # Install pamtester if needed
   sudo apt-get install pamtester
   
   # Test authentication
   pamtester login testuser authenticate
   ```

3. **Check VibeTunnel User Permissions**:
   ```bash
   # VibeTunnel runs as 'vibetunnel' user
   # May need permissions to read /etc/shadow
   groups vibetunnel
   ```

### Proposed Solutions

1. **Immediate Workaround**:
   ```bash
   # Add vibetunnel user to shadow group
   sudo usermod -a -G shadow vibetunnel
   sudo systemctl restart vibetunnel
   ```

2. **Proper Fix**:
   - Configure a dedicated PAM service for VibeTunnel
   - Create `/etc/pam.d/vibetunnel` with appropriate rules
   - Update the authentication service to use this PAM service

3. **Alternative Approach**:
   - Run VibeTunnel as root (not recommended for production)
   - Use a privilege escalation mechanism for PAM auth only

## Test User Setup

For testing multi-user authentication, create a test user:

```bash
# As root or with sudo:
sudo useradd -m -s /bin/bash testuser
sudo passwd testuser  # Set password: <TEST_PASSWORD>

# Verify user creation
id testuser
```

Test credentials are stored in `.gitignore`d file: `test-credentials.txt`

## Recommendations

### High Priority
1. **Fix Session Closing**:
   - Increase SSE reconnection threshold from 3 to 10 attempts
   - Add 10-second grace period before marking sessions as exited
   - Implement better error logging for connection failures

2. **Fix Multi-user Auth**:
   - Check PAM permissions for vibetunnel user
   - Consider creating dedicated PAM service configuration
   - Add debug logging to authentication flow

### Medium Priority
1. **Improve Monitoring**:
   - Add health check endpoint
   - Implement connection quality metrics
   - Create dashboard for session statistics

2. **Documentation**:
   - Document PAM configuration requirements
   - Create troubleshooting guide
   - Add architecture diagram for auth flow

### Low Priority
1. **UI Improvements**:
   - Show connection status indicator
   - Display clear error messages on auth failure
   - Add reconnection button for failed sessions

## Next Steps

1. **Create test user** (requires root access)
2. **Test PAM authentication** with test user
3. **Monitor SSE connections** in browser developer tools
4. **Check server resources** during session creation
5. **Review logs** for specific error patterns

## Code Locations for Fixes

- **Session Management**: `web/src/server/services/session-manager.ts`
- **Connection Manager**: `web/src/client/connection-manager.ts`
- **Authentication Service**: `web/src/server/services/auth-service.ts`
- **PAM Loader**: `web/src/server/services/authenticate-pam-loader.ts`

## Conclusion

Both issues are solvable with targeted fixes:
- Session closing is likely due to aggressive reconnection thresholds
- Multi-user auth failure may be due to PAM permission issues

The VibeTunnel codebase is well-structured and supports these features; the issues appear to be configuration/deployment related rather than fundamental design flaws.