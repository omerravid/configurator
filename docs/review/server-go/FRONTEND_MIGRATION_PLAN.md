# Frontend Migration Plan: Node.js → Go Backend

## Overview

This plan outlines the steps to migrate the existing React frontend from the Node.js backend (port 3003) to the new Go backend (port 3001), ensuring zero downtime and a smooth transition.

## Current State

### Frontend (React + Vite)
- **Location**: `client/`
- **Framework**: React 18.2.0 + Vite 5.0.8
- **Port**: 5173
- **API Proxy**: Currently points to `http://localhost:3003` (Node.js backend)
- **HTTP Client**: Axios with interceptors
- **Auth**: JWT tokens stored in localStorage

### Backend Services
- **Node.js Backend**: Port 3003 (current)
- **Go Backend**: Port 3001 (new, running in Docker)
- **MongoDB**: Port 27017 (shared database)

## Migration Strategy

### Phase 1: Parallel Running (Testing Phase)
Run both backends simultaneously to test compatibility.

### Phase 2: Frontend Switchover
Update frontend to point to Go backend.

### Phase 3: Validation & Monitoring
Verify all features work correctly.

### Phase 4: Decommission Node.js Backend
Remove old backend after successful migration.

---

## Detailed Migration Steps

## Phase 1: Prepare Go Backend for Frontend

### Step 1.1: Verify Go Backend API Compatibility

The Go backend should be compatible with the frontend's API expectations. Review these key areas:

#### ✅ Authentication Endpoints
```
POST /api/auth/login       → ✅ Implemented
POST /api/auth/register    → ✅ Implemented
GET  /api/auth/me          → ✅ Implemented
POST /api/auth/refresh     → ✅ Implemented
```

#### ✅ Configuration Endpoints
```
GET    /api/configs                    → ✅ Implemented
POST   /api/configs                    → ✅ Implemented
GET    /api/configs/:id                → ✅ Implemented (with provenance)
PUT    /api/configs/:id                → ✅ Implemented
DELETE /api/configs/:id                → ✅ Implemented
POST   /api/configs/:id/archive        → ⚠️  Check implementation
POST   /api/configs/:id/restore        → ⚠️  Check implementation
PUT    /api/configs/:id/rename         → ⚠️  Check implementation
GET    /api/configs/:id/data           → ✅ Implemented (path queries)
GET    /api/configs/:id/children       → ⚠️  Check implementation
GET    /api/configs/components         → ⚠️  Check implementation
POST   /api/configs/:id/commit         → ⚠️  Check implementation (USER configs)
```

#### ✅ File Endpoints
```
POST   /api/files/upload              → ✅ Implemented
POST   /api/files/:id/replace         → ✅ Implemented
DELETE /api/files/:id                 → ✅ Implemented
GET    /api/files/:id/download        → ✅ Implemented
POST   /api/folder-import             → ✅ Implemented
POST   /api/file-management/upload    → ✅ Implemented
POST   /api/file-management/replace   → ✅ Implemented
GET    /api/file-management/unreferenced → ✅ Implemented
POST   /api/file-management/regenerate-urls → ✅ Implemented
```

#### ✅ User Management Endpoints
```
GET    /api/users                     → ✅ Implemented
GET    /api/users/:id                 → ✅ Implemented
PUT    /api/users/:id/role            → ✅ Implemented
DELETE /api/users/:id                 → ✅ Implemented
GET    /api/users/:id/configurations  → ✅ Implemented
```

#### ⚠️ Settings/Backup Endpoints (Already Fixed)
```
POST   /api/settings/data/backup      → ✅ Fixed (filename support)
GET    /api/settings/data/backups     → ✅ Implemented
GET    /api/settings/data/backup/:name → ✅ Implemented
POST   /api/settings/data/restore     → ✅ Fixed (accepts filename)
DELETE /api/settings/data/backup/:name → ✅ Implemented
GET    /api/settings/storage          → ✅ Implemented
```

### Step 1.2: Check Missing Endpoints

Based on the frontend API service, these endpoints may need verification:

1. **Archive/Restore Configs**
   - `POST /api/configs/:id/archive`
   - `POST /api/configs/:id/restore`

2. **Rename Config**
   - `PUT /api/configs/:id/rename`

3. **Get Components List**
   - `GET /api/configs/components`

4. **Get Children**
   - `GET /api/configs/:id/children`

5. **Commit User Config**
   - `POST /api/configs/:id/commit`

**Action Required**: Search Go codebase for these endpoints and implement if missing.

---

## Phase 2: Update Frontend Configuration

### Step 2.1: Update Vite Proxy Configuration

**File**: `client/vite.config.js`

**Current**:
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3003",  // Node.js backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**New** (Option A - Direct to Go):
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",  // Go backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**New** (Option B - Environment-based):
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### Step 2.2: Create Environment Configuration

**File**: `client/.env.development`

```bash
# Development - Go Backend
VITE_API_URL=http://localhost:3001

# Or for Docker Go Backend
# VITE_API_URL=http://localhost:3001
```

**File**: `client/.env.development.node` (for rollback)

```bash
# Development - Node.js Backend (rollback)
VITE_API_URL=http://localhost:3003
```

### Step 2.3: Update Docker Compose (Optional)

If you want to run the entire stack in Docker:

**File**: `docker-compose.frontend.yml` (new file)

```yaml
version: "3.8"

services:
  # MongoDB (shared)
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: config_manager
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Go Backend
  api-go:
    build:
      context: ./server-go
      dockerfile: build/Dockerfile
    ports:
      - "3001:3001"
    environment:
      SERVER_PORT: "3001"
      MONGO_URI: mongodb://mongodb:27017
      MONGO_DATABASE: config_manager
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      API_KEY: your-api-key-for-service-to-service-auth
      STORAGE_TYPE: embedded
      STORAGE_BASE_PATH: /app/storage
      LOG_LEVEL: info
      BACKUP_BIN_MONGODUMP: /usr/local/bin/mongodump
      BACKUP_BIN_MONGORESTORE: /usr/local/bin/mongorestore
    volumes:
      - ./server-go/storage:/app/storage
      - ./server-go/backups:/app/backups
    depends_on:
      mongodb:
        condition: service_healthy

  # React Frontend
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001
    volumes:
      - ./client:/app
      - /app/node_modules
    depends_on:
      - api-go

volumes:
  mongodb_data:
```

---

## Phase 3: Testing & Validation

### Step 3.1: Pre-Migration Checklist

Before switching the frontend:

- [ ] Go backend is running and healthy
- [ ] MongoDB is accessible from Go backend
- [ ] All critical endpoints respond correctly
- [ ] JWT authentication works
- [ ] File upload/download works
- [ ] Backup/restore works

### Step 3.2: Create Testing Script

**File**: `test-go-backend-compatibility.sh`

```bash
#!/bin/bash

BASE_URL="http://localhost:3001"
echo "Testing Go Backend Compatibility for Frontend..."

# Test 1: Health Check
echo "1. Health Check..."
curl -s $BASE_URL/api/health | jq .

# Test 2: Login
echo "2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo $LOGIN_RESPONSE | jq .

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# Test 3: Get Current User
echo "3. Testing /api/auth/me..."
curl -s $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 4: List Configs
echo "4. Testing GET /api/configs..."
curl -s $BASE_URL/api/configs \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 5: Create Config
echo "5. Testing POST /api/configs..."
curl -s -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestFrontendConfig","type":"COMPONENT","data":{"test":true}}' | jq .

# Test 6: List Users (Admin)
echo "6. Testing GET /api/users..."
curl -s $BASE_URL/api/users \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 7: File Upload
echo "7. Testing File Upload..."
echo "test content" > /tmp/test-file.txt
curl -s -X POST $BASE_URL/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-file.txt" | jq .

# Test 8: Backup
echo "8. Testing Backup..."
curl -s -X POST $BASE_URL/api/settings/data/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

echo "✅ All tests completed!"
```

### Step 3.3: Frontend Feature Testing Checklist

After switching to Go backend, test these features in the UI:

#### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Logout
- [ ] Token refresh on page reload
- [ ] Protected route access

#### Configuration Management
- [ ] List all configurations
- [ ] Create new COMPONENT
- [ ] Create new PRODUCT
- [ ] Create new USER config
- [ ] View configuration (tree view)
- [ ] Edit configuration data
- [ ] Save configuration changes
- [ ] Delete configuration
- [ ] Archive configuration
- [ ] Restore archived configuration
- [ ] Rename configuration
- [ ] View provenance tooltips
- [ ] Expand/collapse comments

#### File Management
- [ ] Upload file to configuration
- [ ] Replace existing file
- [ ] Download file
- [ ] Delete file
- [ ] View file preview (images)
- [ ] Drag & drop file upload
- [ ] Folder import (JSON + binaries)
- [ ] List unreferenced files
- [ ] Regenerate file URLs

#### User Management (Admin)
- [ ] List all users
- [ ] View user details
- [ ] Change user role
- [ ] Delete user
- [ ] View user's configurations

#### Settings/Admin
- [ ] Create backup
- [ ] List backups
- [ ] Download backup
- [ ] Restore backup
- [ ] Delete backup
- [ ] View storage status

#### UI/UX
- [ ] Dark/Light theme toggle
- [ ] Theme persistence
- [ ] Toast notifications
- [ ] Loading states
- [ ] Error messages
- [ ] Responsive layout

---

## Phase 4: Migration Execution

### Step 4.1: Backup Current State

```bash
# Backup MongoDB
cd server-go/deployments
docker-compose exec mongodb mongodump \
  --db=config_manager \
  --archive=/data/db/pre-frontend-migration.archive \
  --gzip

# Or use the Go backend API
curl -X POST http://localhost:3001/api/settings/data/backup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"pre-frontend-migration"}'
```

### Step 4.2: Stop Node.js Backend (Optional)

If you want to ensure the frontend only talks to Go:

```bash
# Find and stop Node.js backend on port 3003
lsof -ti:3003 | xargs kill -9

# Or if running via npm
pkill -f "node.*server"
```

### Step 4.3: Update Frontend & Restart

```bash
# Update vite.config.js (change target to localhost:3001)
cd client

# Restart Vite dev server
npm run dev
```

### Step 4.4: Monitor Logs

In separate terminals:

```bash
# Terminal 1: Go backend logs
cd server-go/deployments
docker-compose logs -f api-go

# Terminal 2: Frontend dev server
cd client
npm run dev

# Terminal 3: MongoDB logs (optional)
cd server-go/deployments
docker-compose logs -f mongodb
```

---

## Phase 5: Rollback Plan

If issues are found, you can quickly rollback:

### Quick Rollback Steps

1. **Revert Vite Config**
   ```javascript
   // client/vite.config.js
   target: "http://localhost:3003",  // Back to Node.js
   ```

2. **Restart Node.js Backend**
   ```bash
   cd server
   npm start
   ```

3. **Restart Frontend**
   ```bash
   cd client
   npm run dev
   ```

4. **Restore Backup (if needed)**
   ```bash
   curl -X POST http://localhost:3003/api/settings/data/restore \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"filename":"pre-frontend-migration.archive"}'
   ```

---

## Phase 6: Post-Migration Tasks

### Step 6.1: Update Documentation

- [ ] Update README.md with new backend info
- [ ] Update API_SPECIFICATION.md if needed
- [ ] Update ARCHITECTURE_OVERVIEW.md
- [ ] Document any API differences

### Step 6.2: Performance Monitoring

Monitor these metrics:

- **Response Times**: Compare Go vs Node.js
- **Memory Usage**: Go should be more efficient
- **CPU Usage**: Monitor under load
- **Error Rates**: Watch for new errors

### Step 6.3: Decommission Node.js Backend

Once confident (after 1-2 weeks):

```bash
# Remove Node.js backend files (optional)
# mv server server-old-backup

# Update docker-compose.yml to remove Node.js service
# Remove from package.json scripts
```

---

## Known Differences & Compatibility Notes

### Response Format Differences

#### Node.js Backend
```json
{
  "id": "507f1f77bcf86cd799439011",
  "_id": "507f1f77bcf86cd799439011"
}
```

#### Go Backend
```json
{
  "id": "507f1f77bcf86cd799439011"
}
```

**Impact**: Frontend should use `id` field (already does).

### Date Format

Both backends use ISO8601, but Go is more strict:
- Node: `2024-01-15T10:30:00.000Z`
- Go: `2024-01-15T10:30:00Z`

**Impact**: Minimal, JavaScript Date() handles both.

### Error Responses

Ensure Go backend returns errors in the format frontend expects:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Or:

```json
{
  "error": "Error message here"
}
```

---

## Success Criteria

Migration is successful when:

- [ ] All frontend features work with Go backend
- [ ] No console errors in browser
- [ ] All API calls return expected data
- [ ] Authentication flow works correctly
- [ ] File uploads/downloads work
- [ ] Backup/restore works
- [ ] Performance is equal or better
- [ ] No data loss
- [ ] Users can work normally

---

## Timeline Estimate

- **Phase 1** (Verification): 2-4 hours
- **Phase 2** (Configuration): 30 minutes
- **Phase 3** (Testing): 2-3 hours
- **Phase 4** (Migration): 1 hour
- **Phase 5** (Monitoring): 1-2 days
- **Phase 6** (Cleanup): 1-2 weeks

**Total**: ~1 week for full migration with confidence

---

## Next Immediate Steps

1. **Verify Missing Endpoints** - Check if archive/restore/rename/children/components/commit are implemented
2. **Update Vite Config** - Change proxy target to port 3001
3. **Run Compatibility Tests** - Execute test script
4. **Test in Browser** - Go through feature checklist
5. **Monitor & Iterate** - Fix any issues found

---

## Support & Troubleshooting

### Common Issues

**Issue**: CORS errors
**Solution**: Ensure Go backend has proper CORS middleware configured

**Issue**: 401 Unauthorized on all requests
**Solution**: Check JWT secret matches between backends

**Issue**: File uploads fail
**Solution**: Verify storage configuration and permissions

**Issue**: Provenance not showing
**Solution**: Check `includeProvenance` query parameter handling

**Issue**: MongoDB connection errors
**Solution**: Verify MongoDB is accessible from Go container

---

## Conclusion

This migration plan provides a safe, tested approach to switching the frontend from Node.js to Go backend. The parallel running strategy allows for thorough testing before committing to the change, and the rollback plan ensures you can quickly revert if needed.

**Recommendation**: Start with Phase 1 (verification) to identify any missing endpoints before proceeding with the actual migration.

