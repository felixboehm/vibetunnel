# VibeTunnel Activity Detector Regex Fix

## Issue
The VibeTunnel service was crashing due to an invalid regex pattern in the activity detector that monitors Claude CLI status output.

## Root Cause
The regex pattern in `/opt/vibetunnel/vibetunnel/web/src/server/utils/activity-detector.ts` at line 78 contained a greedy quantifier that could cause catastrophic backtracking:

```javascript
// Before (problematic):
/(\S)\s+([\w\s]+?)…\s*\((\d+)s(?:\s*·\s*(\S?)\s*([\d.]+)\s*k?\s*tokens\s*·\s*[^)]+to\s+interrupt)?\)/gi
//                                                                           ^^^^^ greedy quantifier
```

The pattern `[^)]+to\s+interrupt` uses a greedy `+` quantifier that can cause the regex engine to backtrack excessively when trying to match text before "to interrupt".

## Solution
Changed the greedy quantifier to a non-greedy (lazy) quantifier:

```javascript
// After (fixed):
/(\S)\s+([\w\s]+?)…\s*\((\d+)s(?:\s*·\s*(\S?)\s*([\d.]+)\s*k?\s*tokens\s*·\s*[^)]*?to\s+interrupt)?\)/gi
//                                                                           ^^^^^ non-greedy quantifier
```

The change from `[^)]+` to `[^)]*?` makes the regex:
1. Use `*` instead of `+` to allow zero matches (more flexible)
2. Use `?` to make it non-greedy, preventing excessive backtracking

## Additional Fix
Also updated the display text format to include the status indicator to match test expectations:

```javascript
// Before:
displayText = `${action} (${duration}s, ${direction}${formattedTokens})`;

// After:
displayText = `${indicator} ${action} (${duration}s, ${direction}${formattedTokens})`;
```

## Files Modified
- `/home/vibetunnel/work/vibe-space/vibetunnel/web/src/server/utils/activity-detector.ts`

## Testing
The fix addresses the regex issue that was causing crashes when parsing Claude status lines like:
- `✻ Crafting… (205s · ↑ 6.0k tokens · esc to interrupt)`
- `✢ Transitioning… (381s · ↓ 4.0k tokens · esc to interrupt)`
- `◐ Processing… (42s · ↑ 1.2k tokens · esc to interrupt)`

## Deployment Steps
To deploy this fix to the production server:

1. SSH to the server:
   ```bash
   ssh root@<YOUR_SERVER_IP>
   ```

2. Navigate to the VibeTunnel source:
   ```bash
   cd /opt/vibetunnel/vibetunnel/web
   ```

3. Apply the patch to the source file:
   ```bash
   # Edit the file and make the changes shown above
   nano src/server/utils/activity-detector.ts
   ```

4. Rebuild VibeTunnel:
   ```bash
   pnpm run build
   ```

5. Restart the service:
   ```bash
   sudo systemctl restart vibetunnel
   sudo systemctl status vibetunnel
   ```

## Verification
After deployment, verify the fix by:
1. Checking service status: `sudo systemctl status vibetunnel`
2. Monitoring logs: `sudo journalctl -u vibetunnel -f`
3. Testing with Claude CLI to ensure status updates work without crashes