# Rebuild Go Server - Required!

## Why You Need to Rebuild

We made critical fixes to the Go backend that haven't been deployed yet:

### Go Backend Changes:
1. **`server-go/internal/types/configs.go`** - Added `Chain` field to metadata
2. **`server-go/internal/configs/service.go`** - Populate chain data in resolve function
3. **`server-go/internal/http/handlers/configs.go`** - Added DELETE endpoint

These fixes are needed for:
- ✅ Child configurations to show inherited properties
- ✅ Delete functionality to work
- ✅ Proper inheritance chain metadata

## How to Rebuild

### Option 1: Rebuild with Docker Compose (Recommended)
```bash
cd server-go
docker compose -f deployments/docker-compose.yml down
docker compose -f deployments/docker-compose.yml up --build
```

### Option 2: If using a different setup
```bash
cd server-go
# Stop the current server (Ctrl+C)
# Then rebuild and restart
make build
# Or however you normally start your server
```

## What Will Be Fixed After Rebuild

### ✅ Inheritance Chain
- `metadataChainLength` will be 2 (parent + child) instead of 1
- `metadataChain` will have data instead of undefined
- Child configurations will display inherited properties

### ✅ Delete Endpoint
- DELETE /api/configs/:id will work
- No more 404 errors

### ✅ Better Logging
- Inheritance chain resolution logged
- Easier debugging

## After Rebuild

1. **Wait for server to start** (watch logs for "Server started" message)
2. **Hard refresh browser** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Test create child again:**
   - Select "testc" component
   - Right-click → Create child
   - Name it "test_debug2" (or any new name)
   - Click Create
   - **Should now see inherited properties!**

## Verify It Worked

Open browser console (F12) and look for:
```
[InteractiveJSONViewer] Received props: {
  dataKeys: Array(2),        // ← Should show your 2 properties
  dataEmpty: false,          // ← Should be false
  metadataChainLength: 2,    // ← Should be 2 (was 1 before)
  metadataChain: [...]       // ← Should have data (was undefined before)
}
```

If you still see `metadataChainLength: 1`, the rebuild didn't work properly.

## Troubleshooting

### Server won't rebuild?
- Make sure Docker is running
- Try: `docker compose down --volumes` then rebuild
- Check for any running containers: `docker ps`

### Changes not taking effect?
- Verify you're in `server-go` directory
- Ensure `--build` flag is used
- Clear browser cache (Ctrl+Shift+Delete)

### Still not working?
Share the:
1. Docker build output (any errors?)
2. Server startup logs
3. Browser console output when creating child

