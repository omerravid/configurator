## Production Migration Plan: Node.js → Go Configuration Manager

**Goal**: Use the Go server (`server-go/`) as the **only** backend in the final product and retire the existing Node server (`server/`).

---

## 1. Pre-Migration Testing (1–2 days)

### 1.1 Functional Testing
- **Auth & Users**
  - Test register, login, refresh, `/me`
  - Test admin-only endpoints (users list, role changes, deletes)
- **Configurations**
  - CRUD: create, update, rename, archive, restore
  - Resolution with and without provenance
  - Component expansion inside PRODUCT configs
  - Path-based access (including array notation) via `/configs/by-name/:name/data`
- **Rules**
  - Rules CRUD
  - Validation endpoint(s)
  - Inheritance-aware rule lookup
- **Files**
  - Upload (`/api/file-management/upload`)
  - Replace (`/api/file-management/replace`)
  - Delete (`/api/file-management/:storageKey`)
  - Embedded file serving (`/api/files/:storageKey`) and S3 URLs
- **Backups & Settings**
  - Create backup, list backups, download, restore

### 1.2 Data Validation
- Use the **same MongoDB** instance for both Node and Go:
  - Verify that Go reads and writes the same data shapes that Node did
  - Create a few configs via Node (if still active), read them via Go, and compare responses

### 1.3 Load/Stress Testing (optional but recommended)
- Simulate concurrent users performing:
  - Config reads/writes
  - Rules validation
  - File uploads/downloads
- Watch:
  - Response times
  - Memory usage
  - Error logs (400/500s)

---

## 2. Parallel Deployment (Shadow Mode, 2–3 days)

Deploy **both** Node and Go APIs against the same MongoDB and, if possible, the same file storage.

### 2.1 Example docker-compose (local or staging)

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  api-node:
    build: ./server
    ports:
      - "3003:3003"
    environment:
      - MONGODB_URI=mongodb://mongo:27017
      - PORT=3003

  api-go:
    build:
      context: ./server-go
      dockerfile: build/Dockerfile
    ports:
      - "3004:3004"
    environment:
      - MONGODB_URI=mongodb://mongo:27017
      - MONGO_DB_NAME=config_manager
      - SERVER_PORT=3004
      - STORAGE_TYPE=embedded
      - EMBEDDED_STORAGE_PATH=/data/files
      - SERVER_BASE_URL=http://localhost:3004
    volumes:
      - ./data/files:/data/files
      - ./backups:/app/backups

volumes:
  mongo-data:
```

### 2.2 Shadow Testing Strategy
- Keep **Node** as the primary API (used by frontend)
- Use **Go** for:
  - Parallel reads (same config/rules/files)
  - Manual calls via Postman or scripts
- Compare:
  - Response status codes
  - JSON structures and key names
  - Important fields (IDs, timestamps, error messages)

If you find any discrepancies, fix them in Go before proceeding.

---

## 3. Gradual Cutover (1 week)

### 3.1 Switch the Frontend to Go (staging → production)
- Change the API base URL in your frontend:

```js
// Before
const API_BASE_URL = "http://localhost:3003/api";

// After
const API_BASE_URL = "http://localhost:3004/api";
```

or equivalent environment variable configuration.

### 3.2 Run with Node as “Hot Standby”
- Keep the Node service **running but unused**:
  - If something goes wrong, you can quickly point the frontend back to Node
  - This is essentially a rollback safety net

### 3.3 Monitoring During Cutover
- Watch:
  - Go server logs (auth failures, 500s, panics)
  - DB performance
  - Latency of critical endpoints:
    - `/api/configs`
    - `/api/configs/:id`
    - `/api/auth/login`
    - `/api/file-management/upload`
  - File upload/download behavior in real usage

If serious issues appear, **rollback** by pointing clients back to Node immediately, then fix Go and try again.

---

## 4. Production-Ready Deployment (1 day)

### 4.1 Production docker-compose Template

Adapt roughly like this:

```yaml
services:
  mongo:
    image: mongo:7
    restart: always
    volumes:
      - /var/lib/mongo:/data/db

  api:
    build:
      context: ./server-go
      dockerfile: build/Dockerfile
    restart: always
    ports:
      - "3004:3004"
    environment:
      - MONGODB_URI=mongodb://mongo:27017
      - MONGO_DB_NAME=config_manager
      - JWT_SECRET=${JWT_SECRET}
      - API_KEY=${API_KEY}
      - STORAGE_TYPE=${STORAGE_TYPE}             # embedded or s3
      - EMBEDDED_STORAGE_PATH=/data/files
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - AWS_REGION=${AWS_REGION}
      - SERVER_BASE_URL=${SERVER_BASE_URL}       # e.g., https://api.yourdomain.com
      - BACKUP_BIN_MONGODUMP=/usr/local/bin/mongodump
      - BACKUP_BIN_MONGORESTORE=/usr/local/bin/mongorestore
    volumes:
      - /var/lib/config-files:/data/files
      - /var/backups/config-manager:/app/backups
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3004/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 4.2 Deployment Steps
1. **Backup current data**
   - Use your existing Node tooling or `mongodump` directly.
2. **Deploy Go API**
   - Build and start the Go service with `docker compose up -d api`.
3. **Smoke test**
   - Hit `/api/health`.
   - Run a few auth/config/rules/file calls.
4. **Point frontend/clients** to the Go API hostname.

---

## 5. Post-Cutover Monitoring & Rollback Plan

### 5.1 Monitoring Checklist (first 1–2 weeks)
- Logs:
  - Authentication errors
  - 5xx responses frequency
  - Mongo connection issues
- Performance:
  - Response times on config resolve endpoints
  - File upload/download times
- Data:
  - Correctness of resolved configs
  - Rules evaluation behavior
  - Presence of expected files and metadata

### 5.2 Rollback Plan

If you need to rollback:

1. **Re-enable Node API service** (container or process).
2. **Update frontend configuration** to point back to the Node base URL.
3. Optionally:
   - Stop Go containers if they’re causing issues.

Rollback is easy because both services share the same MongoDB store and similar file layout (for embedded storage).

---

## 6. Decommissioning the Node Server

Only do this after you’ve run on Go in production **without issues** for some time (e.g., 2–4 weeks).

### 6.1 Codebase Cleanup
- In your repo:
  - Remove or archive the `server/` directory (Node backend).
  - Remove Node-specific Dockerfiles/compose services.
  - Remove Node dependencies from root configs (e.g., root `package.json` if only used for server).

### 6.2 Git Hygiene
- Tag the last commit that still contains the Node server:
  - e.g., `git tag node-backend-final`
  - So you can always check it out in the future if needed.

### 6.3 Documentation Updates
- Update:
  - `README.md` to point to `server-go` as the *only* backend.
  - Any deployment docs to only mention Go.
  - Internal runbooks/playbooks with Go-specific commands:
    - `go build`, `go test`
    - Docker build/push commands

---

## 7. Final Pre-Deletion Checklist

Before fully deleting Node:

- [ ] All features you care about are **implemented and tested** in Go.
- [ ] Frontend works entirely against Go API.
- [ ] Backups/restores tested using Go endpoints.
- [ ] File upload/download workflows used in real scenarios.
- [ ] No open bugs that require Node-specific behavior.
- [ ] Team is comfortable operating and debugging the Go service.
- [ ] A clear rollback plan is documented (even if rarely needed).

Once all boxes are checked, you can safely consider the Node server **retired** and the Go server your **final production backend**.


