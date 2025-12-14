## Configuration Manager: Node.js → Go Migration Plan

**Document Purpose**: This plan describes how to migrate the Configuration Manager backend from the existing Node.js/Express service to the Go (`server-go/`) implementation while preserving API compatibility and minimizing risk.  
**Related Docs**: `MIGRATION_SUMMARY.md`, `MIGRATION_COMPLETE.md`, `PRODUCTION_MIGRATION_PLAN.md`

---

## 1. Objectives & Scope

- **Primary objective**: Replace the Node.js backend with the Go implementation with **100% API compatibility** and **no breaking changes** for existing clients.
- **Secondary objectives**:
  - Improve performance (startup time, memory usage, concurrency).
  - Improve reliability and maintainability via static typing and standard Go project layout.
  - Simplify deployment (single compiled binary, smaller Docker images).

- **In scope**:
  - Re‑implement all existing backend features in Go:
    - Authentication, users, configurations, rules, files, settings/backup.
    - Advanced config resolution (inheritance, component expansion, provenance, minimal mode, array-based path traversal).
    - File management, folder import, URL regeneration.
  - Side‑by‑side deployment of Node and Go APIs for testing.
  - Gradual production cutover from Node to Go.

- **Out of scope** (for this migration):
  - New product features unrelated to existing behavior (e.g. GraphQL, WebSockets).
  - Major schema changes to MongoDB collections.

---

## 2. High‑Level Approach

- **Side‑by‑side services**:
  - Keep Node service in `server/` on port **3003**.
  - Run Go service in `server-go/` on port **3004**.
- **Single shared MongoDB**:
  - Use a single MongoDB instance accessed by both services.
  - Remove legacy SQLite/dual DB support; keep Mongo as the single source of truth.
- **Compatibility‑first**:
  - Mirror existing REST endpoints and response shapes.
  - Treat any difference in behavior as a **bug to be fixed**, not a new feature.
- **Docker‑based deployment**:
  - Use Docker Compose for local and pre‑production environments.
  - Use multi‑stage Go builds for small, self‑contained images.

---

## 3. Migration Phases & Deliverables

> Phase structure is derived from `MIGRATION_SUMMARY.md` and `MIGRATION_COMPLETE.md`.  
> Duration estimates are indicative and assume a small team (1–2 engineers).

### Phase 1: Core Infrastructure (1–2 days)

- **Goals**:
  - Set up Go project (`server-go/`) using standard layout.
  - Implement core HTTP/API infrastructure and Mongo integration.
- **Key tasks**:
  - Initialize Go module, dependencies, and `cmd/server/main.go`.
  - Implement core packages: `config`, `logger`, `mongo`, `http/router`, middleware.
  - Add `/api/health` and basic error handling.
  - Create Dockerfile (multi‑stage build) and base `docker-compose.yml`.
- **Exit criteria**:
  - Go service builds and runs locally.
  - `/api/health` works via Docker Compose.

### Phase 2: Authentication, Users & Permissions (1–2 days)

- **Goals**:
  - Provide full auth and user management parity with Node.
  - Enforce role‑based access control and config ownership rules.
- **Key tasks**:
  - Implement `/api/auth` endpoints: `login`, `register`, `me`, `refresh`.
  - Implement `/api/users` endpoints: list, get, update role, delete, list configurations.
  - Add JWT + API key middleware; integrate bcrypt password hashing.
  - Implement `requireAdmin` middleware and config ownership checks.
- **Exit criteria**:
  - Admins can fully manage users through the Go API.
  - Non‑admin users are restricted to their own configs as in Node.

### Phase 3: Configurations & Advanced Features (2–3 days)

- **Goals**:
  - Achieve full parity for all configuration operations and resolution behaviors.
- **Key tasks**:
  - Implement CRUD and lifecycle endpoints under `/api/configs`:
    - Create, list/filter, get, update, rename, children, by‑name, commit, archive, restore.
  - Port and validate advanced resolution logic:
    - Inheritance chain resolution and deep merge.
    - Component reference expansion.
    - Full provenance tracking (source metadata).
    - Path traversal with array notation (`items[0].name`, nested indexes).
    - Minimal mode unwrapping to match Node behavior.
- **Exit criteria**:
  - Go config resolution responses match Node for a curated set of representative configs.
  - Edge cases (components, arrays, minimal mode) behave identically.

### Phase 4: Rules Service (1–2 days)

- **Goals**:
  - Reproduce the Node rules engine behavior and validation features.
- **Key tasks**:
  - Implement `/api/rules` endpoints (CRUD, validate, by config/path).
  - Support numeric, pattern (regex), and collection (enum) validators.
  - Implement inheritance behaviors and component path handling.
  - Add strong validation of rule definitions on create/update.
- **Exit criteria**:
  - Rule evaluation results (pass/fail, messages) match Node for test cases.

### Phase 5: File Management, Folder Import & URL Regeneration (2–3 days)

- **Goals**:
  - Achieve parity for file upload/download, metadata, and folder import behavior.
- **Key tasks**:
  - Implement file serving and metadata endpoints under `/api/files`.
  - Implement file CRUD under `/api/file-management` (upload, delete, replace).
  - Integrate file references into config data (`{ _type: "file", _metadata, _link }`).
  - Implement unreferenced file cleanup.
  - Implement `/api/folder-import` with two‑pass processing (JSON + binary).
  - Add environment‑aware URL regeneration on config retrieval.
- **Exit criteria**:
  - All file‑related flows work equivalently to Node (embedded and S3 storage).
  - Folder imports and regenerated URLs behave identically in tests.

### Phase 6: Settings, Backup & Initialization (1–2 days)

- **Goals**:
  - Complete settings, backup/restore, and initialization features.
- **Key tasks**:
  - Implement `/api/settings/data/*` endpoints:
    - Backup creation, listing, download, delete.
    - Restore from file (upload/restore, upload/update).
    - JSON export/import if required.
  - Implement storage settings endpoints (if needed) and health/status checks.
  - Implement default admin user creation and optional sample data seeding.
- **Exit criteria**:
  - End‑to‑end backup/restore works via Go API using configured tools.
  - Fresh environments come up with a default admin user.

### Phase 7: Testing, Hardening & Cutover (2–3 days)

- **Goals**:
  - Validate Go service behavior against Node, harden for production, and perform a safe cutover.
- **Key tasks**:
  - Implement automated integration tests for Go service.
  - Implement contract tests that run against both Node and Go APIs:
    - Shared test suite for key endpoints and edge cases.
  - Perform load testing (e.g. 1000 req/s) and compare latency/error rates.
  - Add structured logging, request IDs, and Docker healthchecks.
- **Exit criteria**:
  - Go service passes the contract test suite against Node.
  - Load tests show equal or better performance and stability.
  - Monitoring and healthchecks are in place for production environments.

---

## 4. Environment & Configuration

- **Core environment variables** (see `MIGRATION_SUMMARY.md` and `MIGRATION_COMPLETE.md` for full list):

```env
MONGODB_URI=mongodb://mongo:27017
MONGO_DB_NAME=config_manager
JWT_SECRET=your-secret-key-here
API_KEY=your-api-key-here
SERVER_PORT=3004
SERVER_BASE_URL=https://api.yourcompany.com

STORAGE_TYPE=embedded            # or s3
EMBEDDED_STORAGE_PATH=/data/files

S3_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

BACKUP_BIN_MONGODUMP=/usr/local/bin/mongodump
BACKUP_BIN_MONGORESTORE=/usr/local/bin/mongorestore
```

- **Local & pre‑prod**:
  - Prefer Docker Compose to run Mongo and the Go API together.
  - Keep Node API available (port 3003) for comparison during migration.

---

## 5. Testing & Verification Strategy

- **Unit & integration tests**:
  - Cover core services: auth, configs (including resolution), rules, files, backup.
  - Ensure behavior matches expectations independent of Node.

- **Contract tests vs Node**:
  - Build a shared Postman or automated test suite that:
    - Calls both Node (`http://localhost:3003`) and Go (`http://localhost:3004`) for the same scenarios.
    - Compares status codes and response payloads (allowing minor error message wording differences).

- **Manual exploratory testing**:
  - Use Postman/Insomnia for complex flows (folder import, advanced inheritance, file uploads).
  - Validate role‑based access and permissions for ADMIN vs USER roles.

- **Load & resilience tests**:
  - Simulate realistic traffic patterns and compare:
    - p50/p95 latency.
    - Error rate under sustained load.
    - Behavior during restarts and deployment rollouts.

---

## 6. Deployment & Cutover Plan

- **Pre‑production rollout**:
  1. Deploy Go service alongside Node in a non‑production environment.
  2. Run the full contract test suite against both services.
  3. Run load tests using production‑like data.
  4. Fix any discrepancies and retest until parity is achieved.

- **Production deployment**:
  1. Deploy Go service in production alongside Node using Docker Compose or equivalent.
  2. Configure monitoring, logging, and healthchecks (`/api/health`).
  3. **Shadow traffic** (optional): send read‑only traffic to Go while Node remains the primary.
  4. Gradually route more traffic (especially writes) to Go, monitoring errors and performance.
  5. Once stable for at least **1 week**, switch all clients to Go as the primary API.

- **Rollback strategy**:
  - Keep Node service fully deployable for the duration of cutover.
  - Do not introduce backward‑incompatible schema changes while Node is still a fallback.
  - If critical issues are discovered:
    - Switch client traffic back to Node.
    - Use Mongo backups or point‑in‑time recovery if necessary.

- **Decommissioning Node**:
  - After a stable period and no remaining parity gaps:
    - Remove Node service from the standard deployment pipeline.
    - Archive Node codebase and documentation as reference.

---

## 7. Risks & Mitigations

- **Behavioral differences between Node and Go**:
  - **Mitigation**: Strict contract tests, heavy use of pre‑prod environments, explicit parity sign‑off.
- **Data corruption or inconsistent writes**:
  - **Mitigation**: Use a single MongoDB, avoid dual‑write strategies, rely on backups and transaction‑like patterns where needed.
- **Performance regressions**:
  - **Mitigation**: Load testing and benchmarks prior to cutover; monitor CPU/memory and latency.
- **Security regressions (auth/permissions)**:
  - **Mitigation**: Dedicated tests for RBAC, config ownership, and admin‑only routes.

---

## 8. Completion Criteria

The migration is considered **successfully completed** when:

1. All endpoints listed in `MIGRATION_COMPLETE.md` are implemented and verified in Go.
2. Contract tests against Node show no functional regressions for supported scenarios.
3. Load tests show equal or better performance for Go compared to Node.
4. Go service has been running in production as the primary API for at least one full release cycle with no migration‑related incidents.
5. Node service has been cleanly decommissioned and documented as legacy.

For details of the final migrated system and metrics, see `MIGRATION_COMPLETE.md`.


