# Configuration Manager: Node.js to Go Migration Summary

**Date**: 2025-01-17  
**Status**: Phase 1 Complete — Core API Functional  
**Repository**: `server-go/` (side-by-side with Node `server/`)

---

## Migration Overview

### Objective
Migrate the Configuration Manager backend from Node.js/Express to Go, preserving API compatibility while improving performance and type safety.

### Approach
- **Side-by-side deployment**: Go service in `server-go/`, Node service remains in `server/`
- **Single database**: MongoDB via Docker (removed SQLite and dual-DB support for simplicity)
- **Standard Go layout**: Following [golang-standards/project-layout](https://github.com/golang-standards/project-layout)
- **Docker-based**: Docker Compose with Mongo + Go API containers
- **Ports**: Node on 3003, Go on 3004 (allows parallel testing)

---

## Technology Stack

### Core
- **Framework**: Gin (HTTP router)
- **Database**: MongoDB (official driver `go.mongodb.org/mongo-driver`)
- **Auth**: `golang-jwt/jwt/v5` + bcrypt
- **Validation**: `go-playground/validator/v10`
- **Config**: `spf13/viper` (env-based)
- **Logging**: `uber-go/zap`
- **File Storage**: Local filesystem + AWS S3 (SDK v2)

### Project Structure
```
server-go/
├── cmd/server/main.go              # Entrypoint
├── internal/
│   ├── auth/                       # JWT generation
│   ├── backup/                     # Backup/restore service
│   ├── config/                     # Viper config loader
│   ├── configs/                    # Configuration resolution service
│   ├── files/                      # File storage (local + S3)
│   ├── http/
│   │   ├── handlers/               # Route handlers
│   │   │   ├── auth.go
│   │   │   ├── configs.go
│   │   │   ├── rules.go
│   │   │   ├── files.go
│   │   │   └── settings.go
│   │   ├── middleware/             # Auth middleware
│   │   └── router.go               # Route registration
│   ├── logger/                     # Zap wrapper
│   ├── mongo/                      # Mongo client + indexes
│   ├── rules/                      # Rules validation service
│   └── types/                      # DTOs and models
├── build/
│   └── Dockerfile                  # Multi-stage build
├── deployments/
│   └── docker-compose.yml          # Mongo + API services
└── go.mod
```

---

## ✅ Completed Features

### 1. Authentication (`/api/auth`)
- **POST** `/login` — JWT token generation (24h expiry)
- **POST** `/register` — User creation with role (ADMIN/USER)
- **GET** `/me` — Current user info (protected)
- **POST** `/refresh` — Token refresh (protected)
- **Middleware**: JWT Bearer + X-API-Key fallback
- **Password hashing**: bcrypt (cost 10)

### 2. Configurations (`/api/configs`)
- **GET** `/configs` — List with filters (type, archived)
- **POST** `/configs` — Create with validation (unique name+type)
- **GET** `/configs/:id` — Resolved config with provenance
- **GET** `/configs/:id/data?minimal=true` — Data only (no metadata)
- **PUT** `/configs/:id` — Update with deep merge
- **PUT** `/configs/:id/rename` — Rename (admin only, conceptually)
- **GET** `/configs/:id/children?includeArchived=false` — Child configs
- **GET** `/configs/by-name/:name/data?path=...&minimal=true` — By name + path traversal
- **POST** `/configs/:id/commit` — Commit USER/VERSION configs
- **POST** `/configs/:id/archive` — Archive config
- **POST** `/configs/:id/restore` — Restore archived config
- **Service**: Basic inheritance chain resolution with deep merge

### 3. Rules (`/api/rules`)
- **GET** `/rules?configurationId=...` — List rules for config
- **POST** `/rules` — Create rule with validation
- **GET** `/rules/:id` — Get single rule
- **PUT** `/rules/:id` — Update rule
- **DELETE** `/rules/:id` — Delete rule
- **POST** `/rules/validate` — Validate value against rules
- **GET** `/rules/configuration/:configId/path/:path?includeInherited=true` — Rules by path with inheritance
- **Validators**: Numeric (operators), Pattern (regex), Collection (enum)

### 4. Files (`/api/files`)
- **GET** `/files/:storageKey` — Serve file (embedded storage only)
- **GET** `/files/:storageKey/info` — File metadata + download URL
- **Storage**: Local filesystem + S3 (presigned URLs for S3)
- **Metadata**: JSON sidecar files for embedded storage

### 5. Settings & Backup (`/api/settings`)
- **POST** `/settings/data/backup` — Create backup via mongodump
- **GET** `/settings/data/backups` — List available backups
- **GET** `/settings/data/backup/:backupName` — Download backup archive
- **POST** `/settings/data/restore` — Restore from backup via mongorestore
- **DELETE** `/settings/data/backup/:backupName` — Delete backup
- **GET** `/settings/storage` — Storage status
- **Tools**: mongodump/mongorestore installed in Docker image

### 6. Infrastructure
- **MongoDB**: Single instance via Docker (mongo:7)
- **Indexes**: users.username (unique), configurations (name+type unique, parent_id, type, archived), rules (configuration_id, property_path, enabled)
- **Docker**: Multi-stage build (Go 1.25 + Ubuntu 22.04 + MongoDB tools)
- **Health**: `/api/health` endpoint

---

## ❌ Missing for Full Parity

### High Priority

#### 1. Users Management (`/api/users`)
**Missing endpoints**:
- `GET /api/users` — List all users (admin only)
- `GET /api/users/:id` — Get user by ID
- `PUT /api/users/:id/role` — Update user role (admin only)
- `DELETE /api/users/:id` — Delete user (admin only, prevent self-delete)
- `GET /api/users/:id/configurations` — User's configurations

**Impact**: Admins cannot manage users via API.

#### 2. Configuration Service Enhancements
**Missing logic**:
- **Component reference expansion**: When a PRODUCT config contains `{ Battery: { componentId: "...", versionId: "..." } }`, resolve and merge the component/version data inline
- **Schema enforcement**: Validate that child configs only override properties defined in parent (prevent arbitrary new keys)
- **Provenance tracking**: Current implementation is simplified; Node preserves full source metadata through inheritance chains
- **Path traversal with arrays**: Support `path[0].field` notation in `getValueAtPath`
- **Minimal mode extraction**: Recursively unwrap `{value, source}` provenance wrappers

**Impact**: Advanced config features (component composition, strict schema) don't work.

#### 3. Rules Enhancements
**Missing logic**:
- **Component path stripping**: When rules are on a component and accessed via `Battery.charging.maxWatts`, strip `Battery.` prefix before matching
- **Rule config validation**: Validate numeric/pattern/collection configs on create/update (e.g., ensure `operator` is valid, regex compiles)

**Impact**: Rules on components may not match correctly; invalid rules can be created.

#### 4. File Management
**Missing endpoints**:
- `POST /api/file-management/upload` — Upload file (multipart)
- `DELETE /api/file-management/:storageKey` — Delete file
- `POST /api/folder-import` — Import folder structure from ZIP

**Missing integration**:
- Files stored in config data as `{_type: "file", _metadata: {...}, _link: "..."}` objects
- URL regeneration on config retrieval (fix localhost URLs for deployed environments)

**Impact**: Cannot upload files via API; files in configs not properly handled.

#### 5. Permissions & Access Control
**Missing middleware application**:
- `requireAdmin` not applied to admin-only routes (rename, archive, restore, delete configs, user management)
- Config ownership checks: non-admin users should only modify their own USER/VERSION configs (Node has `checkConfigPermissions`)

**Impact**: Security gap—regular users can perform admin actions.

### Medium Priority

#### 6. Settings Enhancements
**Missing endpoints**:
- `POST /api/settings/data/upload-restore` — Upload backup file and restore (multipart)
- `POST /api/settings/data/upload-update` — Upload and merge (preserve existing, override matching)
- JSON export/import endpoints (fallback for portability)

**Missing features**:
- Database switching (Node supports multiple DBs; Go is single Mongo)
- Storage settings CRUD (update S3 credentials, test connection)

**Impact**: Backup restore requires manual file placement; no runtime storage config changes.

#### 7. Initialization & Seeding
**Missing logic**:
- Default admin user creation if DB is empty (username: `admin`, password: `admin123`)
- Sample data seeding (optional, via env flag)

**Impact**: Fresh deployments require manual user creation.

#### 8. Error Handling & Validation
**Gaps**:
- Validation error messages don't match Node's Joi output format
- Inconsistent error shapes (some return `{ error: string }`, others vary)
- Missing detailed validation errors (e.g., which field failed)

**Impact**: Client error handling may break; less user-friendly errors.

### Low Priority

#### 9. Observability
**Missing**:
- Detailed request/response logging (Node logs method, path, status, duration)
- Structured logging with request IDs
- Metrics (neither Node nor Go have this, so not a parity issue)

**Impact**: Harder to debug production issues.

#### 10. Docker & Deployment
**Missing**:
- Backup directory volume mount in docker-compose
- Docker healthcheck using `/api/health`
- Graceful shutdown improvements (wait for in-flight requests)

**Impact**: Backups lost on container restart; no health monitoring.

---

## Known Issues & Technical Debt

### 1. ID Handling
- **Current**: Mongo ObjectIDs converted to hex strings for responses; parsed back for queries
- **Issue**: Inconsistent with Node (which uses string IDs directly)
- **Fix**: Consider using string IDs throughout or document the conversion

### 2. Session Context
- **Current**: Using `mongodrv.NewSessionContext(ctx, nil)` for sessionless operations
- **Issue**: Transactions not supported (not needed for current use cases)
- **Fix**: Add transaction support if multi-doc operations are needed

### 3. Deep Merge
- **Current**: Simple object merge; arrays and primitives replace
- **Issue**: Node has more nuanced merge (e.g., explicit `null` deletes keys)
- **Fix**: Port Node's `deepMerge` logic exactly

### 4. Path Traversal
- **Current**: Dot notation only (`system.logging.level`)
- **Issue**: Array notation not supported (`items[0].name`)
- **Fix**: Extend `getValueAtPath` to handle `[index]` syntax

### 5. Storage Manager
- **Current**: S3 presigned URLs work; embedded storage serves files
- **Issue**: No upload endpoint; file metadata not integrated with configs
- **Fix**: Add multipart upload handler; store file refs in config data

---

## Testing Status

### Manual Testing (Postman)
- ✅ Auth: login, register, me, refresh
- ✅ Configs: create, list, get, update, rename, children, by-name, commit, archive, restore
- ✅ Rules: CRUD, validate (not tested with inheritance yet)
- ⚠️ Files: info endpoint works; serve not tested
- ⚠️ Backup: create/list work; restore not tested

### Integration Testing
- ❌ No automated tests yet
- ❌ No contract tests against Node API

### Load Testing
- ❌ Not performed

---

## Next Steps (Prioritized)

### ✅ Phase 2: Users & Permissions (COMPLETED)
1. ✅ Implemented user management endpoints (GET, PUT role, DELETE, GET configurations)
2. ✅ Applied `requireAdmin` middleware to admin-only routes
3. ✅ Added config ownership checks (`checkConfigPermissions` equivalent)
4. ⏳ Test role-based access control (see PHASE2_TESTING.md)

### ✅ Phase 3: Advanced Config Features (COMPLETED)
1. ✅ Component reference expansion in resolve
2. ⏸️ Schema enforcement validation (deferred - low priority)
3. ✅ Full provenance tracking (preserve source metadata)
4. ✅ Array notation in path traversal (`path[0].field`, `matrix[1][2]`)
5. ✅ Minimal mode recursive unwrapping

### ✅ Phase 4: File Management (COMPLETED)
1. ✅ File upload endpoint (multipart)
2. ✅ File deletion endpoint
3. ✅ File replacement endpoint
4. ✅ Integrate file metadata in config data
5. ✅ Unreferenced file cleanup

### ✅ Phase 5: Folder Import & URL Regeneration (COMPLETED)
1. ✅ Folder import (multiple files with structure)
2. ✅ URL regeneration on config retrieval
3. ✅ Config attachment support
4. ✅ Two-pass processing (JSON + binary)

### Phase 5: Settings & Backup Enhancements (1 day)
1. Upload/restore from file (multipart)
2. JSON export/import endpoints
3. Storage settings CRUD

### Phase 6: Initialization & Polish (1 day)
1. Default admin user creation
2. Sample data seeding
3. Consistent error handling
4. Request logging improvements
5. Docker healthcheck

### Phase 7: Testing & Cutover (2-3 days)
1. Write integration tests
2. Contract tests against Node API
3. Load testing
4. Run both APIs in parallel, compare responses
5. Switch clients to Go API
6. Deprecate Node API

---

## Environment Variables

### Required
```env
MONGODB_URI=mongodb://mongo:27017
MONGO_DB_NAME=config_manager
JWT_SECRET=your-secret-key
API_KEY=your-api-key
```

### Optional
```env
SERVER_PORT=3004
STORAGE_TYPE=embedded          # or s3
EMBEDDED_STORAGE_PATH=/data/files
S3_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SERVER_BASE_URL=http://localhost:3004
BACKUP_BIN_MONGODUMP=/usr/local/bin/mongodump
BACKUP_BIN_MONGORESTORE=/usr/local/bin/mongorestore
```

---

## Running the Go Service

### Local Development
```bash
cd server-go
go mod download
go run cmd/server/main.go
```

### Docker (Recommended)
```bash
docker compose -f server-go/deployments/docker-compose.yml up --build
```

### Access
- Go API: http://localhost:3004
- Node API: http://localhost:3003 (if still running)
- MongoDB: localhost:27017

---

## API Compatibility Notes

### Identical Endpoints
All implemented endpoints return the same JSON shapes as Node, with these exceptions:
- **IDs**: Mongo ObjectIDs as hex strings (Node uses string IDs directly)
- **Timestamps**: ISO 8601 format (same as Node)
- **Error messages**: Slightly different wording in some cases

### Breaking Changes
None intentionally introduced; any differences are bugs to be fixed.

---

## References
- [Standard Go Project Layout](https://github.com/golang-standards/project-layout)
- [Gin Web Framework](https://gin-gonic.com/)
- [MongoDB Go Driver](https://www.mongodb.com/docs/drivers/go/current/)
- [AWS SDK for Go v2](https://aws.github.io/aws-sdk-go-v2/)

---

**End of Summary**

