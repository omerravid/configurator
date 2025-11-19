# Frontend Migration Quick Start

## Overview
This guide will help you quickly switch your React frontend from the Node.js backend (port 3003) to the new Go backend (port 3001).

## Prerequisites

- ✅ Go backend is running (port 3001)
- ✅ MongoDB is running (port 27017)
- ✅ Go backend has been tested and is working

## Quick Migration Steps

### Step 1: Backup Current Data (Safety First!)

```bash
# Using the Go backend API
curl -X POST http://localhost:3001/api/settings/data/backup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"pre-frontend-migration"}'
```

Or manually backup MongoDB:

```bash
cd server-go/deployments
docker-compose exec mongodb mongodump \
  --db=config_manager \
  --out=/data/db/backup-$(date +%Y%m%d)
```

### Step 2: Update Frontend Proxy Configuration

**Edit `client/vite.config.js`:**

Change this line:
```javascript
target: "http://localhost:3003",  // Old Node.js backend
```

To:
```javascript
target: "http://localhost:3001",  // New Go backend
```

**Full file should look like:**

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",  // ← Changed to Go backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
```

### Step 3: Restart Frontend Dev Server

```bash
cd client

# Stop the current dev server (Ctrl+C if running)

# Start it again
npm run dev
```

The frontend will now be at `http://localhost:5173` and will proxy API calls to the Go backend at port 3001.

### Step 4: Test in Browser

Open `http://localhost:5173` and test:

1. **Login** - Use your credentials
2. **Dashboard** - Should load configurations
3. **Create Config** - Try creating a new configuration
4. **File Upload** - Test file operations
5. **User Management** - If admin, check user list

### Step 5: Monitor Logs

Keep an eye on the Go backend logs to see requests coming in:

```bash
cd server-go/deployments
docker-compose logs -f api-go
```

You should see structured logs like:

```
2025-11-19T10:30:45.123Z	INFO	Incoming request	{"requestId": "...", "method": "POST", "path": "/api/auth/login", ...}
2025-11-19T10:30:45.234Z	INFO	Request completed	{"status": 200, "duration": "111ms", ...}
```

## Rollback (If Needed)

If something doesn't work, you can quickly rollback:

### 1. Revert Vite Config

Change `client/vite.config.js` back to:

```javascript
target: "http://localhost:3003",  // Back to Node.js
```

### 2. Start Node.js Backend

```bash
cd server
npm start
```

### 3. Restart Frontend

```bash
cd client
npm run dev
```

## Common Issues & Solutions

### Issue: CORS Errors

**Symptom**: Console shows CORS policy errors

**Solution**: The Go backend should have CORS middleware. Check `server-go/internal/http/router.go` has proper CORS setup.

### Issue: 401 Unauthorized

**Symptom**: All API calls return 401

**Solution**: 
1. Clear browser localStorage: `localStorage.clear()`
2. Login again
3. Check JWT_SECRET matches between Node.js and Go backends

### Issue: File Downloads Don't Work

**Symptom**: File downloads fail or return 404

**Solution**: 
1. Check `STORAGE_TYPE` env var in Go backend
2. Verify storage directory exists and has correct permissions
3. Check file URLs in database match storage location

### Issue: Some Features Missing

**Symptom**: Certain UI features don't work

**Solution**: Check the Go backend has all required endpoints. See `server-go/FRONTEND_MIGRATION_PLAN.md` for full endpoint list.

## Verification Checklist

After migration, verify these work:

- [ ] Login/Logout
- [ ] List configurations
- [ ] Create new configuration (PRODUCT, COMPONENT, USER)
- [ ] Edit configuration
- [ ] Delete configuration
- [ ] Archive/Restore configuration
- [ ] Upload file
- [ ] Download file
- [ ] View file preview
- [ ] User management (admin)
- [ ] Create backup
- [ ] Restore backup
- [ ] Theme toggle (dark/light)
- [ ] Provenance tooltips

## Performance Comparison

You should notice:

- **Faster Response Times**: Go is generally faster than Node.js
- **Lower Memory Usage**: Go uses less memory
- **Better Concurrency**: Go handles concurrent requests better
- **Structured Logs**: Better debugging with structured logging

## Next Steps

Once you're confident the Go backend works well:

1. **Run for a few days** - Monitor for any issues
2. **Test all features** - Go through the full feature checklist
3. **Performance testing** - Compare response times
4. **Decommission Node.js** - After 1-2 weeks of stable operation

## Need Help?

- Check `server-go/FRONTEND_MIGRATION_PLAN.md` for detailed migration plan
- Check `server-go/COMPLETE_TESTING_GUIDE.md` for testing procedures
- Check `server-go/LOGGER_INTEGRATION_COMPLETE.md` for logging info
- Review Go backend logs for errors

## Summary

**That's it!** You've migrated your frontend to use the Go backend. The change is just one line in `vite.config.js`:

```diff
- target: "http://localhost:3003",
+ target: "http://localhost:3001",
```

Everything else should work exactly the same! 🚀

