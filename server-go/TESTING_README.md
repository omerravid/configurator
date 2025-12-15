# Testing Guide

This guide explains how to run and write tests for the Go Configuration Manager.

## Quick Start

### Prerequisites

1. **Go 1.25+** installed
2. **MongoDB** running (for integration tests)
   ```bash
   docker run -d -p 27017:27017 mongo:7
   ```
3. **Test dependencies** installed
   ```bash
   make install-deps
   # or manually:
   go get github.com/stretchr/testify
   go get go.uber.org/mock
   ```

### Running Tests

```bash
# Run all tests
make test

# Run only unit tests (fast)
make test-unit

# Run only integration tests
make test-integration

# Run tests with coverage report
make test-coverage

# View coverage in browser
make coverage-html

# Run tests with race detector
make test-race

# Run tests with verbose output
make test-verbose
```

### Running Specific Tests

```bash
# Test specific package
go test ./internal/auth/...

# Test specific function
go test -run TestLogin ./internal/http/handlers/...

# Test with verbose output
go test -v ./internal/configs/...

# Using Makefile targets
make test-auth       # Auth tests
make test-configs    # Config tests
make test-rules      # Rules tests
make test-middleware # Middleware tests
```

## Test Organization

```
server-go/
├── internal/
│   ├── auth/
│   │   ├── jwt.go
│   │   └── jwt_test.go              # Unit tests
│   ├── configs/
│   │   ├── service.go
│   │   └── service_test.go          # Unit tests
│   ├── http/
│   │   ├── handlers/
│   │   │   ├── auth.go
│   │   │   └── auth_test.go         # Handler tests
│   │   └── middleware/
│   │       ├── auth.go
│   │       └── auth_test.go         # Middleware tests
│   └── rules/
│       ├── service.go
│       └── service_test.go          # Unit tests
└── tests/
    ├── fixtures/                    # Test data
    │   ├── users.go
    │   ├── configs.go
    │   └── rules.go
    ├── testutil/                    # Test utilities
    │   ├── db.go
    │   └── server.go
    └── integration/                 # Integration tests
        ├── auth_flow_test.go
        ├── config_lifecycle_test.go
        └── rules_validation_test.go
```

## Test Types

### 1. Unit Tests

Test individual functions/methods in isolation.

**Location**: Next to the code being tested (e.g., `service_test.go`)

**Example**:
```go
func TestGenerateToken_ValidInputs_ReturnsValidToken(t *testing.T) {
    // Arrange
    secret := "test-secret"
    userID := "user123"
    
    // Act
    token, err := GenerateToken(secret, userID, "testuser", "USER", 24*time.Hour)
    
    // Assert
    require.NoError(t, err)
    assert.NotEmpty(t, token)
}
```

**Run unit tests**:
```bash
make test-unit
```

### 2. Handler Tests

Test HTTP handlers with real HTTP requests.

**Location**: `internal/http/handlers/*_test.go`

**Example**:
```go
func TestLogin_ValidCredentials_ReturnsToken(t *testing.T) {
    router, handler, cleanup := setupAuthTest(t)
    defer cleanup()
    
    // Insert test user
    user := fixtures.AdminUser()
    handler.db.Users.InsertOne(context.Background(), user)
    
    // Make HTTP request
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
    router.ServeHTTP(w, req)
    
    assert.Equal(t, http.StatusOK, w.Code)
}
```

### 3. Integration Tests

Test complete flows with real database.

**Location**: `tests/integration/*_test.go`

**Example**:
```go
func TestCompleteAuthFlow(t *testing.T) {
    // Setup
    db, cleanup := testutil.SetupTestDB(t)
    defer cleanup()
    
    // Register -> Login -> Access Protected Endpoint
    // Full flow testing
}
```

**Run integration tests**:
```bash
make test-integration
```

## Writing Tests

### Using Arrange-Act-Assert Pattern

All tests follow the AAA pattern:

```go
func TestExample(t *testing.T) {
    // Arrange - Set up test data and dependencies
    user := fixtures.AdminUser()
    service := NewService()
    
    // Act - Execute the code being tested
    result, err := service.DoSomething(user)
    
    // Assert - Verify the results
    require.NoError(t, err)
    assert.Equal(t, expectedValue, result)
}
```

### Using Table-Driven Tests

For testing multiple scenarios:

```go
func TestValidateNumeric(t *testing.T) {
    tests := []struct {
        name     string
        operator string
        value    float64
        want     bool
    }{
        {"greater than true", "greater", 10, true},
        {"greater than false", "greater", 5, false},
        // ... more cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Arrange
            config := map[string]interface{}{
                "operator": tt.operator,
                "value":    tt.value,
            }
            
            // Act
            result := validateNumeric(config, 8)
            
            // Assert
            assert.Equal(t, tt.want, result)
        })
    }
}
```

### Using Test Fixtures

Reuse common test data:

```go
// In test
user := fixtures.AdminUser()
config := fixtures.ProductConfig("TestProduct")
rule := fixtures.NumericRule(config.ID, "price", "greater", 50)
```

### Using Test Utilities

```go
// Setup test database
db, cleanup := testutil.SetupTestDB(t)
defer cleanup()

// Setup test server
server := testutil.SetupTestServer(t)
defer server.Cleanup()
```

## Best Practices

### 1. Test Naming

```go
// Pattern: Test<FunctionName>_<Scenario>_<ExpectedResult>
func TestLogin_ValidCredentials_ReturnsToken(t *testing.T)
func TestResolve_MultiLevelInheritance_MergesCorrectly(t *testing.T)
func TestAuth_ExpiredToken_ReturnsUnauthorized(t *testing.T)
```

### 2. Use require vs assert

```go
// Use require for critical checks (stops test on failure)
require.NoError(t, err)
require.NotNil(t, result)

// Use assert for non-critical checks (continues test on failure)
assert.Equal(t, expected, actual)
assert.True(t, condition)
```

### 3. Always Clean Up

```go
func TestExample(t *testing.T) {
    db, cleanup := testutil.SetupTestDB(t)
    defer cleanup()  // Always defer cleanup
    
    // ... test code
}
```

### 4. Use t.Helper()

```go
func setupTest(t *testing.T) {
    t.Helper()  // Mark as helper function
    // ... setup code
}
```

### 5. Test Both Success and Failure

```go
func TestLogin_ValidCredentials_ReturnsToken(t *testing.T) { }
func TestLogin_InvalidCredentials_ReturnsUnauthorized(t *testing.T) { }
func TestLogin_EmptyCredentials_ReturnsBadRequest(t *testing.T) { }
```

## Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Services | 90%+ | TBD |
| Handlers | 80%+ | TBD |
| Middleware | 90%+ | TBD |
| Utilities | 95%+ | TBD |
| **Overall** | **80%+** | **TBD** |

### Checking Coverage

```bash
# Generate coverage report
make test-coverage

# View in browser
make coverage-html

# Check specific package
go test -cover ./internal/auth/...

# Detailed coverage by function
go tool cover -func=coverage.out
```

## Continuous Integration

Tests run automatically in CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: make test-ci
  env:
    TEST_MONGODB_URI: mongodb://localhost:27017
```

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB is running
docker ps | grep mongo

# Start MongoDB if not running
docker run -d -p 27017:27017 mongo:7

# Set MongoDB URI for tests
export TEST_MONGODB_URI=mongodb://localhost:27017
```

### Test Timeouts

```bash
# Increase timeout
go test ./... -timeout 60s

# Or in individual test
func TestSlowOperation(t *testing.T) {
    // Test will timeout after 5 minutes
}
```

### Race Conditions

```bash
# Run with race detector
make test-race

# Or directly
go test -race ./...
```

### Test Cache Issues

```bash
# Clear test cache
make clean

# Or directly
go clean -testcache
```

## Mocking

Generate mocks using gomock:

```bash
# Generate all mocks
make mocks

# Generate specific mock
mockgen -source=internal/files/storage.go \
        -destination=internal/files/mocks/storage_mock.go \
        -package=mocks
```

Using mocks in tests:

```go
func TestWithMock(t *testing.T) {
    ctrl := gomock.NewController(t)
    defer ctrl.Finish()
    
    mockStorage := mocks.NewMockStorage(ctrl)
    mockStorage.EXPECT().
        StoreFile(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
        Return(&files.FileMetadata{FileID: "test"}, nil)
    
    // Use mock in test
}
```

## Additional Resources

- [Testing Strategy Document](./TESTING_STRATEGY.md) - Comprehensive testing plan
- [Go Testing Package](https://pkg.go.dev/testing) - Official Go testing docs
- [Testify Documentation](https://github.com/stretchr/testify) - Assertion library
- [Gomock Documentation](https://github.com/golang/mock) - Mocking framework

## Getting Help

If you have questions about testing:

1. Check the [Testing Strategy Document](./TESTING_STRATEGY.md)
2. Look at existing test examples in the codebase
3. Run `make help` to see available test commands
4. Check the test output with `-v` flag for more details

## Next Steps

1. ✅ Review testing strategy
2. ✅ Set up test infrastructure
3. ⏳ Write unit tests for services
4. ⏳ Write handler tests
5. ⏳ Write integration tests
6. ⏳ Achieve 80%+ coverage
7. ⏳ Integrate with CI/CD


