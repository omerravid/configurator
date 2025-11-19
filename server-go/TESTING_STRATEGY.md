# Testing Strategy - Go Configuration Manager

## Overview

This document outlines the comprehensive testing strategy for the Go Configuration Manager backend. We follow best practices using:
- **gomock** for mocking dependencies
- **testify** for assertions and test suites
- **Arrange-Act-Assert (AAA)** pattern for test structure
- **Table-driven tests** for testing multiple scenarios

## Test Pyramid Structure

```
                    /\
                   /  \
                  /    \
                 /  E2E \     <- Integration Tests (20%)
                /        \
               /----------\
              /   API/     \  <- Handler Tests (30%)
             /  Integration \
            /--------------  \
           /                  \
          /   Unit Tests       \ <- Service/Logic Tests (50%)
         /____________________  \
```

## 1. Unit Tests (50% of test coverage)

### 1.1 Service Layer Tests

#### `internal/auth/jwt_test.go`
**What to test:**
- ✅ Token generation with valid inputs
- ✅ Token expiration time is correctly set
- ✅ Claims are correctly encoded
- ✅ Generated token can be parsed back
- ❌ Error handling for invalid secret

**Dependencies:** None (pure function)

#### `internal/configs/service_test.go`
**What to test:**
- ✅ `Resolve()`: Basic inheritance chain resolution
- ✅ `Resolve()`: Deep merge with provenance tracking
- ✅ `Resolve()`: Component reference expansion
- ✅ `Resolve()`: Multiple levels of inheritance
- ✅ `expandComponentReferences()`: Valid component/version references
- ✅ `expandComponentReferences()`: Invalid/missing references
- ✅ `expandComponentReferences()`: Non-component objects
- ✅ `inheritanceChain()`: Single config (no parent)
- ✅ `inheritanceChain()`: Multi-level chain
- ✅ `inheritanceChain()`: Circular reference handling
- ✅ `defaultStatus()`: Status defaults for USER/VERSION
- ✅ `defaultStatus()`: Status for other types

**Mock dependencies:** `*mongo.Collection` (using gomock)

#### `internal/rules/service_test.go`
**What to test:**
- ✅ `FindByConfigurationID()`: Returns rules for config
- ✅ `FindByConfigurationID()`: Returns empty for no rules
- ✅ `FindByConfigurationAndPath()`: Filters by path correctly
- ✅ `FindByConfigurationAndPathWithInheritance()`: Walks parent chain
- ✅ `ValidateValue()`: Numeric rules (all operators)
- ✅ `ValidateValue()`: Pattern rules with regex
- ✅ `ValidateValue()`: Collection rules
- ✅ `ValidateValue()`: Multiple rules on same value
- ✅ `ValidateValue()`: Inheritance of rules
- ✅ `validateNumeric()`: Edge cases (boundary values)
- ✅ `validatePattern()`: Invalid regex handling
- ✅ `validateCollection()`: Type mismatches

**Mock dependencies:** `*mongo.Collection` (rules and configs)

#### `internal/backup/service_test.go`
**What to test:**
- ✅ `CreateBackup()`: Successful backup creation
- ✅ `CreateBackup()`: Auto-generated name
- ✅ `CreateBackup()`: Mongodump command construction
- ✅ `CreateBackup()`: Error handling when mongodump fails
- ✅ `RestoreBackup()`: Successful restore
- ✅ `RestoreBackup()`: Pre-restore backup creation
- ✅ `RestoreBackup()`: File not found error
- ✅ `ListBackups()`: Lists all .archive files
- ✅ `ListBackups()`: Empty directory
- ✅ `DeleteBackup()`: Successful deletion
- ✅ `DeleteBackup()`: Non-existent file

**Mock dependencies:** Mock filesystem operations or use temp directories

#### `internal/files/storage_test.go`
**What to test:**

**Embedded Storage:**
- ✅ `StoreFile()`: Successful file storage
- ✅ `StoreFile()`: Creates directory if not exists
- ✅ `StoreFile()`: Generates unique storage keys
- ✅ `StoreFile()`: Creates metadata file
- ✅ `GetFileContent()`: Retrieves file and metadata
- ✅ `GetFileContent()`: File not found error
- ✅ `GenerateDownloadURL()`: Correct URL format
- ✅ `DeleteFile()`: Removes file and metadata
- ✅ `ListAllFiles()`: Lists all files with metadata

**S3 Storage:**
- ✅ `StoreFile()`: Uploads to S3 successfully
- ✅ `StoreFile()`: Error handling for S3 failures
- ✅ `GetFileContent()`: Downloads from S3
- ✅ `GenerateDownloadURL()`: Generates presigned URL
- ✅ `DeleteFile()`: Deletes from S3

**Mock dependencies:** AWS S3 client (using interfaces), filesystem operations

### 1.2 Middleware Tests

#### `internal/http/middleware/auth_test.go`
**What to test:**
- ✅ `Auth()`: Valid JWT token authentication
- ✅ `Auth()`: Expired JWT token rejection
- ✅ `Auth()`: Invalid JWT token rejection
- ✅ `Auth()`: Malformed Authorization header
- ✅ `Auth()`: Valid API key authentication
- ✅ `Auth()`: Invalid API key rejection
- ✅ `Auth()`: No authentication provided
- ✅ `Auth()`: JWT takes precedence over API key (if both provided)
- ✅ `RequireAdmin()`: ADMIN role passes
- ✅ `RequireAdmin()`: USER role rejected
- ✅ `RequireAdmin()`: No user in context rejected
- ✅ `CheckConfigPermissions()`: Admin can modify any config
- ✅ `CheckConfigPermissions()`: User can modify own USER config
- ✅ `CheckConfigPermissions()`: User cannot modify others' config
- ✅ `CheckConfigPermissions()`: User cannot modify PRODUCT config
- ✅ `CheckConfigPermissions()`: Cannot modify COMMITTED config
- ✅ `CheckConfigPermissions()`: Can commit DRAFT config
- ✅ `CheckConfigPermissions()`: Config not found error

**Mock dependencies:** `*mongo.Client`, Gin context

### 1.3 Utility/Helper Tests

#### `internal/configs/path_test.go`
**What to test:**
- ✅ Path traversal with dot notation
- ✅ Path traversal with array notation
- ✅ Path traversal with nested arrays
- ✅ Invalid path handling
- ✅ Missing keys

#### `internal/configs/provenance_test.go`
**What to test:**
- ✅ Deep merge with provenance
- ✅ Deep merge without provenance
- ✅ Overriding values
- ✅ Nested object merging
- ✅ Array handling

## 2. Handler Tests (30% of test coverage)

Handler tests verify HTTP request/response handling without mocking the database.
They use a test database (or mocked services).

### 2.1 `internal/http/handlers/auth_test.go`
**What to test:**
- ✅ `POST /api/auth/login`: Successful login
- ✅ `POST /api/auth/login`: Invalid credentials
- ✅ `POST /api/auth/login`: Missing fields
- ✅ `POST /api/auth/login`: User not found
- ✅ `POST /api/auth/register`: Successful registration
- ✅ `POST /api/auth/register`: Duplicate username
- ✅ `POST /api/auth/register`: Invalid input validation
- ✅ `POST /api/auth/register`: Password hashing verification
- ✅ `GET /api/auth/me`: Returns current user
- ✅ `GET /api/auth/me`: Unauthorized without token
- ✅ `POST /api/auth/refresh`: Generates new token
- ✅ `POST /api/auth/refresh`: Unauthorized without token

### 2.2 `internal/http/handlers/configs_test.go`
**What to test:**
- ✅ `GET /api/configs`: List all configs
- ✅ `GET /api/configs?type=PRODUCT`: Filter by type
- ✅ `GET /api/configs?archived=true`: Include archived
- ✅ `POST /api/configs`: Create config successfully
- ✅ `POST /api/configs`: Validation errors
- ✅ `POST /api/configs`: Duplicate name+type constraint
- ✅ `GET /api/configs/:id`: Get config by ID
- ✅ `GET /api/configs/:id`: Not found error
- ✅ `GET /api/configs/:id/data`: Get resolved data
- ✅ `GET /api/configs/:id/data?minimal=true`: Minimal mode
- ✅ `PUT /api/configs/:id`: Update config
- ✅ `PUT /api/configs/:id`: Permission checks
- ✅ `PUT /api/configs/:id/rename`: Rename config
- ✅ `GET /api/configs/:id/children`: Get children
- ✅ `GET /api/configs/by-name/:name/data`: Get by name
- ✅ `GET /api/configs/by-name/:name/data?path=x.y`: Path traversal
- ✅ `POST /api/configs/:id/commit`: Commit draft
- ✅ `POST /api/configs/:id/commit`: Cannot commit non-draft
- ✅ `POST /api/configs/:id/archive`: Archive config
- ✅ `POST /api/configs/:id/restore`: Restore config

### 2.3 `internal/http/handlers/rules_test.go`
**What to test:**
- ✅ `GET /api/rules?configurationId=X`: List rules
- ✅ `POST /api/rules`: Create rule
- ✅ `POST /api/rules`: Validation errors
- ✅ `GET /api/rules/:id`: Get single rule
- ✅ `PUT /api/rules/:id`: Update rule
- ✅ `DELETE /api/rules/:id`: Delete rule
- ✅ `POST /api/rules/validate`: Validate value
- ✅ `GET /api/rules/configuration/:id/path/:path`: Rules by path
- ✅ `GET /api/rules/configuration/:id/path/:path?includeInherited=true`: Inherited rules

### 2.4 `internal/http/handlers/users_test.go`
**What to test:**
- ✅ `GET /api/users`: List all users (admin only)
- ✅ `GET /api/users`: Forbidden for non-admin
- ✅ `GET /api/users/:id`: Get user by ID
- ✅ `PUT /api/users/:id/role`: Update role (admin only)
- ✅ `PUT /api/users/:id/role`: Cannot update own role
- ✅ `DELETE /api/users/:id`: Delete user (admin only)
- ✅ `DELETE /api/users/:id`: Cannot delete self
- ✅ `GET /api/users/:id/configurations`: Get user's configs

### 2.5 `internal/http/handlers/files_test.go`
**What to test:**
- ✅ `GET /api/files/:storageKey`: Serve file
- ✅ `GET /api/files/:storageKey`: Not found error
- ✅ `GET /api/files/:storageKey/info`: File metadata

### 2.6 `internal/http/handlers/file_management_test.go`
**What to test:**
- ✅ `POST /api/file-management/upload`: Upload file
- ✅ `POST /api/file-management/upload`: Multipart validation
- ✅ `DELETE /api/file-management/:storageKey`: Delete file

### 2.7 `internal/http/handlers/settings_test.go`
**What to test:**
- ✅ `POST /api/settings/data/backup`: Create backup
- ✅ `GET /api/settings/data/backups`: List backups
- ✅ `GET /api/settings/data/backup/:name`: Download backup
- ✅ `POST /api/settings/data/restore`: Restore backup
- ✅ `DELETE /api/settings/data/backup/:name`: Delete backup
- ✅ `GET /api/settings/storage`: Storage status

## 3. Integration Tests (20% of test coverage)

Integration tests verify end-to-end flows with a real test database.

### 3.1 `tests/integration/auth_flow_test.go`
**Scenarios:**
- ✅ Complete auth flow: register → login → access protected endpoint → refresh token
- ✅ Role-based access control: admin vs user permissions
- ✅ Token expiration and refresh flow

### 3.2 `tests/integration/config_lifecycle_test.go`
**Scenarios:**
- ✅ Complete config lifecycle: create → update → commit → archive → restore
- ✅ Inheritance chain: INSTANCE → USER → VERSION
- ✅ Component reference expansion in PRODUCT configs
- ✅ Path traversal and minimal mode
- ✅ Ownership and permission checks

### 3.3 `tests/integration/rules_validation_test.go`
**Scenarios:**
- ✅ Create config with rules → validate values against rules
- ✅ Inherited rules from parent configs
- ✅ Multiple rule types on same property
- ✅ Rule override behavior

### 3.4 `tests/integration/file_management_test.go`
**Scenarios:**
- ✅ Upload file → store in config → retrieve → delete
- ✅ URL regeneration on config retrieval
- ✅ Unreferenced file cleanup

### 3.5 `tests/integration/backup_restore_test.go`
**Scenarios:**
- ✅ Create backup → restore → verify data integrity
- ✅ Pre-restore backup creation

## 4. Testing Tools & Setup

### 4.1 Required Dependencies

```bash
# Add to go.mod
go get github.com/stretchr/testify
go get go.uber.org/mock/mockgen
```

### 4.2 Mock Generation

Create `Makefile` for mock generation:

```makefile
.PHONY: mocks
mocks:
	mockgen -source=internal/files/storage.go -destination=internal/files/mocks/storage_mock.go -package=mocks
	mockgen -source=vendor/go.mongodb.org/mongo-driver/mongo/collection.go -destination=internal/mocks/mongo_collection_mock.go -package=mocks
	# Add more as needed
```

### 4.3 Test Database Setup

For integration tests, use a test MongoDB instance:

```go
// tests/testutil/db.go
func SetupTestDB(t *testing.T) (*mongo.Client, func()) {
    uri := os.Getenv("TEST_MONGODB_URI")
    if uri == "" {
        uri = "mongodb://localhost:27017"
    }
    
    ctx := context.Background()
    client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
    require.NoError(t, err)
    
    dbName := fmt.Sprintf("test_db_%d", time.Now().UnixNano())
    db := client.Database(dbName)
    
    cleanup := func() {
        db.Drop(context.Background())
        client.Disconnect(context.Background())
    }
    
    return client, cleanup
}
```

### 4.4 Test HTTP Server Setup

```go
// tests/testutil/server.go
func SetupTestServer(t *testing.T) (*gin.Engine, *mongo.Client, func()) {
    gin.SetMode(gin.TestMode)
    
    client, cleanupDB := SetupTestDB(t)
    
    cfg := config.Config{
        JWTSecret: "test-secret",
        APIKey:    "test-api-key",
        MongoDB:   client.Database("test").Name(),
        // ... other config
    }
    
    router := gin.New()
    // Register routes
    
    cleanup := func() {
        cleanupDB()
    }
    
    return router, client, cleanup
}
```

## 5. Test Execution Strategy

### 5.1 Running Tests

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run with detailed coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run only unit tests
go test -short ./...

# Run only integration tests
go test -run Integration ./...

# Run specific package
go test ./internal/configs/...

# Run with race detector
go test -race ./...

# Run with verbose output
go test -v ./...
```

### 5.2 CI/CD Integration

**GitHub Actions example:**

```yaml
name: Go Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.25'
      
      - name: Install dependencies
        run: go mod download
      
      - name: Run tests
        run: go test -v -race -coverprofile=coverage.out ./...
        env:
          TEST_MONGODB_URI: mongodb://localhost:27017
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.out
```

## 6. Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Services (internal/*/service.go) | 90%+ | HIGH |
| Handlers (internal/http/handlers/) | 80%+ | HIGH |
| Middleware (internal/http/middleware/) | 90%+ | HIGH |
| Utilities (path, provenance) | 95%+ | MEDIUM |
| JWT generation | 85%+ | MEDIUM |
| File storage | 75%+ | MEDIUM |
| Backup service | 70%+ | LOW |

**Overall Target: 80%+ code coverage**

## 7. Test Naming Conventions

### Test Function Names
```go
// Pattern: Test<FunctionName>_<Scenario>_<ExpectedResult>
func TestLogin_ValidCredentials_ReturnsToken(t *testing.T)
func TestResolve_MultiLevelInheritance_MergesCorrectly(t *testing.T)
func TestAuth_ExpiredToken_ReturnsUnauthorized(t *testing.T)
```

### Table-Driven Tests
```go
func TestValidateNumeric(t *testing.T) {
    tests := []struct {
        name     string
        operator string
        value    float64
        ruleVal  float64
        want     bool
    }{
        {"greater than true", "greater", 10, 5, true},
        {"greater than false", "greater", 5, 10, false},
        // ... more cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Arrange, Act, Assert
        })
    }
}
```

## 8. Common Testing Patterns

### 8.1 Arrange-Act-Assert Pattern

```go
func TestCreateConfig(t *testing.T) {
    // Arrange
    mockDB := setupMockDB(t)
    service := configs.New(mockDB.Configurations)
    input := types.Configuration{
        Name: "test-config",
        Type: types.ConfigProduct,
    }
    
    // Act
    result, err := service.Create(context.Background(), input)
    
    // Assert
    require.NoError(t, err)
    assert.Equal(t, "test-config", result.Name)
    assert.NotEmpty(t, result.ID)
}
```

### 8.2 Mock Setup Pattern

```go
func setupMockCollection(t *testing.T) *mocks.MockCollection {
    ctrl := gomock.NewController(t)
    t.Cleanup(ctrl.Finish)
    
    mockCol := mocks.NewMockCollection(ctrl)
    return mockCol
}
```

### 8.3 Test Fixtures

```go
// tests/fixtures/configs.go
func ProductConfig() types.Configuration {
    return types.Configuration{
        Name: "Product-A",
        Type: types.ConfigProduct,
        Data: map[string]interface{}{
            "price": 100,
        },
    }
}
```

## 9. Testing Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Test Names**: Use descriptive names that explain the scenario
3. **Single Assertion Concept**: Test one behavior per test (when practical)
4. **Use Subtests**: For table-driven tests and related scenarios
5. **Mock External Dependencies**: Don't call real external APIs
6. **Test Error Paths**: Don't just test the happy path
7. **Use Test Fixtures**: Reuse common test data
8. **Clean Up Resources**: Always defer cleanup functions
9. **Parallel Tests**: Use `t.Parallel()` for independent tests
10. **Avoid Test Interdependence**: Don't rely on test execution order

## 10. Next Steps

1. ✅ Review this strategy with the team
2. ⏳ Set up testing infrastructure (mocks, fixtures)
3. ⏳ Start with high-priority unit tests (services)
4. ⏳ Add handler tests
5. ⏳ Implement integration tests
6. ⏳ Set up CI/CD pipeline
7. ⏳ Achieve 80%+ coverage
8. ⏳ Document test maintenance procedures

---

**Last Updated**: {{DATE}}
**Status**: 🟡 Draft - Ready for Implementation

