# Testing Documentation Index

This document serves as a quick reference to all testing-related documentation and files.

## 📚 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) | Quick overview and next steps | 5 min |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Complete testing strategy and plan | 20 min |
| [TESTING_README.md](./TESTING_README.md) | How to run and write tests | 10 min |
| [Makefile](./Makefile) | Test automation commands | 2 min |

## 🚀 Quick Start

```bash
# 1. Install dependencies
make install-deps

# 2. Start MongoDB (for integration tests)
docker run -d -p 27017:27017 mongo:7

# 3. Run tests
make test

# 4. View coverage
make test-coverage
```

## 📁 File Structure

```
server-go/
├── Makefile                           # Test commands
├── TESTING_INDEX.md                   # This file
├── TESTING_SUMMARY.md                 # Overview & next steps
├── TESTING_STRATEGY.md                # Complete strategy
├── TESTING_README.md                  # How-to guide
│
├── internal/                          # Source code + unit tests
│   ├── auth/
│   │   ├── jwt.go
│   │   └── jwt_test.go               ✅ Example: Simple unit test
│   ├── configs/
│   │   ├── service.go
│   │   └── service_test.go           ✅ Example: Service with DB
│   ├── rules/
│   │   ├── service.go
│   │   └── service_test.go           ✅ Example: Table-driven tests
│   └── http/
│       ├── handlers/
│       │   ├── auth.go
│       │   └── auth_test.go          ✅ Example: HTTP handler test
│       └── middleware/
│           ├── auth.go
│           └── auth_test.go          ✅ Example: Middleware test
│
└── tests/                             # Test infrastructure
    ├── fixtures/                      # Test data generators
    │   ├── users.go                  ✅ User fixtures
    │   ├── configs.go                ✅ Config fixtures
    │   └── rules.go                  ✅ Rule fixtures
    │
    ├── testutil/                      # Test utilities
    │   ├── db.go                     ✅ Database setup
    │   └── server.go                 ✅ Server setup
    │
    └── integration/                   # Integration tests
        └── config_lifecycle_test.go  ✅ Example: E2E test
```

## 🎯 Test Categories

### Unit Tests (50% of coverage goal)

Test individual functions in isolation.

**Examples:**
- ✅ `internal/auth/jwt_test.go` - Token generation
- ✅ `internal/configs/service_test.go` - Config resolution
- ✅ `internal/rules/service_test.go` - Rule validation

**To Create:**
- ⏳ `internal/backup/service_test.go`
- ⏳ `internal/files/storage_test.go`
- ⏳ `internal/configs/path_test.go`
- ⏳ `internal/configs/provenance_test.go`

### Handler Tests (30% of coverage goal)

Test HTTP endpoints with real requests.

**Examples:**
- ✅ `internal/http/handlers/auth_test.go` - Auth endpoints

**To Create:**
- ⏳ `internal/http/handlers/configs_test.go`
- ⏳ `internal/http/handlers/rules_test.go`
- ⏳ `internal/http/handlers/users_test.go`
- ⏳ `internal/http/handlers/files_test.go`
- ⏳ `internal/http/handlers/file_management_test.go`
- ⏳ `internal/http/handlers/settings_test.go`

### Middleware Tests

Test authentication and authorization logic.

**Examples:**
- ✅ `internal/http/middleware/auth_test.go` - Auth middleware

### Integration Tests (20% of coverage goal)

Test complete user flows with real database.

**Examples:**
- ✅ `tests/integration/config_lifecycle_test.go` - Config lifecycle

**To Create:**
- ⏳ `tests/integration/auth_flow_test.go`
- ⏳ `tests/integration/rules_validation_test.go`
- ⏳ `tests/integration/file_management_test.go`
- ⏳ `tests/integration/backup_restore_test.go`

## 🛠️ Common Commands

```bash
# Run all tests
make test

# Run unit tests only (fast)
make test-unit

# Run integration tests only
make test-integration

# Run with coverage report
make test-coverage

# View coverage in browser
make coverage-html

# Run with race detector
make test-race

# Run specific package
go test ./internal/auth/...

# Run specific test
go test -run TestLogin ./internal/http/handlers/...

# Clean test cache
make clean
```

## 📝 Test Patterns Reference

### 1. Arrange-Act-Assert (AAA)

```go
func TestExample(t *testing.T) {
    // Arrange - Setup
    input := "test"
    
    // Act - Execute
    result := DoSomething(input)
    
    // Assert - Verify
    assert.Equal(t, expected, result)
}
```

### 2. Table-Driven Tests

```go
func TestMultipleScenarios(t *testing.T) {
    tests := []struct {
        name string
        input int
        want int
    }{
        {"case 1", 1, 2},
        {"case 2", 2, 4},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Double(tt.input)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

### 3. Using Fixtures

```go
func TestWithFixtures(t *testing.T) {
    user := fixtures.AdminUser()
    config := fixtures.ProductConfig("Test")
    
    // Use in test...
}
```

### 4. Database Tests

```go
func TestWithDB(t *testing.T) {
    db, cleanup := testutil.SetupTestDB(t)
    defer cleanup()
    
    // Test with real database...
}
```

### 5. HTTP Handler Tests

```go
func TestHandler(t *testing.T) {
    router, handler, cleanup := setupTest(t)
    defer cleanup()
    
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodGet, "/test", nil)
    router.ServeHTTP(w, req)
    
    assert.Equal(t, http.StatusOK, w.Code)
}
```

## 📊 Coverage Goals

| Component | Target | Status |
|-----------|--------|--------|
| Services | 90%+ | ⏳ To be measured |
| Handlers | 80%+ | ⏳ To be measured |
| Middleware | 90%+ | ⏳ To be measured |
| Utilities | 95%+ | ⏳ To be measured |
| **Overall** | **80%+** | ⏳ To be measured |

## ✅ Implementation Checklist

### Phase 1: Infrastructure (✅ COMPLETE)
- ✅ Test utilities created
- ✅ Fixtures created
- ✅ Makefile created
- ✅ Documentation written
- ✅ Example tests provided

### Phase 2: Unit Tests (⏳ IN PROGRESS)
- ✅ Auth JWT tests
- ✅ Configs service tests
- ✅ Rules service tests
- ⏳ Backup service tests
- ⏳ File storage tests
- ⏳ Path utility tests
- ⏳ Provenance tests

### Phase 3: Handler Tests (⏳ TO DO)
- ✅ Auth handler tests
- ⏳ Configs handler tests
- ⏳ Rules handler tests
- ⏳ Users handler tests
- ⏳ Files handler tests
- ⏳ Settings handler tests

### Phase 4: Integration Tests (⏳ TO DO)
- ✅ Config lifecycle test
- ⏳ Auth flow test
- ⏳ Rules validation test
- ⏳ File management test
- ⏳ Backup/restore test

### Phase 5: CI/CD (⏳ TO DO)
- ⏳ GitHub Actions setup
- ⏳ Coverage reporting
- ⏳ Automated test runs
- ⏳ Quality gates

## 🎓 Learning Path

### For Beginners

1. **Start Here**: [TESTING_SUMMARY.md](./TESTING_SUMMARY.md)
2. **Read**: [TESTING_README.md](./TESTING_README.md) - Sections 1-3
3. **Study**: `internal/auth/jwt_test.go` (simplest example)
4. **Practice**: Write a simple unit test
5. **Study**: `internal/rules/service_test.go` (table-driven tests)
6. **Practice**: Write a table-driven test

### For Intermediate

1. **Study**: `internal/http/handlers/auth_test.go` (HTTP testing)
2. **Study**: `internal/http/middleware/auth_test.go` (middleware)
3. **Practice**: Write handler tests
4. **Study**: `tests/integration/config_lifecycle_test.go` (integration)
5. **Read**: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

### For Advanced

1. **Read**: Full [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
2. **Implement**: All remaining tests
3. **Set up**: CI/CD pipeline
4. **Review**: Team testing practices
5. **Mentor**: Help others write tests

## 🔍 Finding Information

**"How do I run tests?"**
→ See [TESTING_README.md](./TESTING_README.md) or `make help`

**"What tests do we need?"**
→ See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) Section 1-3

**"How do I write a test?"**
→ See example test files or [TESTING_README.md](./TESTING_README.md) Section 5

**"What's the testing approach?"**
→ See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) Section 8-9

**"What's already done?"**
→ See [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) Section 1-3

**"What needs to be done?"**
→ See [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) Section 4

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| MongoDB connection fails | `docker run -d -p 27017:27017 mongo:7` |
| Import errors | `go mod tidy` |
| Test cache issues | `make clean` |
| Tests timeout | Increase timeout: `go test ./... -timeout 60s` |
| Race conditions detected | Fix the code, not the test |

## 📞 Support

- Check example test files for patterns
- Read the documentation files
- Run `make help` for available commands
- Use `go test -v` for verbose output

## 🎯 Success Metrics

You're on track when:
- ✅ Tests run successfully
- ✅ Coverage increases with each PR
- ✅ New code includes tests
- ✅ CI/CD pipeline is green
- ✅ Team follows testing patterns
- ✅ Tests catch bugs before production

---

**Quick Links:**
- 📖 [Summary](./TESTING_SUMMARY.md) - What's done, what's next
- 📖 [Strategy](./TESTING_STRATEGY.md) - Complete testing plan
- 📖 [README](./TESTING_README.md) - How to run and write tests
- 🔧 [Makefile](./Makefile) - Test commands
- 📁 [Examples](./internal/) - Example test files
- 🧪 [Fixtures](./tests/fixtures/) - Test data
- 🛠️ [Utilities](./tests/testutil/) - Test helpers

**Status:** 🟢 Ready for Implementation  
**Last Updated:** {{DATE}}

