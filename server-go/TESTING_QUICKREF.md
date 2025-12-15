# Testing Quick Reference Card

> **TL;DR**: Everything you need to know about testing in one page

## 🚀 Quick Start (30 seconds)

```bash
cd server-go
make install-deps    # Install testify + gomock
make test           # Run all tests
```

## 📁 Files Created for You

```
✅ Test Infrastructure
   ├── tests/testutil/db.go          # Database setup
   ├── tests/testutil/server.go      # HTTP server setup
   ├── tests/fixtures/users.go       # User test data
   ├── tests/fixtures/configs.go     # Config test data
   └── tests/fixtures/rules.go       # Rule test data

✅ Example Tests (Follow These Patterns)
   ├── internal/auth/jwt_test.go              # Simple unit test
   ├── internal/configs/service_test.go       # Service with DB
   ├── internal/rules/service_test.go         # Table-driven tests
   ├── internal/http/handlers/auth_test.go    # HTTP handler test
   ├── internal/http/middleware/auth_test.go  # Middleware test
   └── tests/integration/config_lifecycle_test.go  # E2E test

✅ Documentation
   ├── TESTING_INDEX.md       # This is your map (start here!)
   ├── TESTING_SUMMARY.md     # What's done & next steps
   ├── TESTING_STRATEGY.md    # Complete strategy (detailed)
   └── TESTING_README.md      # How-to guide (practical)

✅ Tools
   └── Makefile               # All test commands
```

## 🎯 The Three Testing Patterns

### Pattern 1: Simple Unit Test (No Database)

```go
// File: internal/mypackage/myfeature_test.go
func TestMyFunction_Scenario_ExpectedResult(t *testing.T) {
    // Arrange
    input := "test"
    
    // Act
    result := MyFunction(input)
    
    // Assert
    require.NoError(t, err)
    assert.Equal(t, expected, result)
}
```

**When:** Pure functions, no external dependencies  
**Example:** `internal/auth/jwt_test.go`

### Pattern 2: Test With Database

```go
func TestWithDB(t *testing.T) {
    // Setup
    db, cleanup := testutil.SetupTestDB(t)
    defer cleanup()
    
    // Use fixtures
    config := fixtures.ProductConfig("Test")
    db.Configurations.InsertOne(ctx, config)
    
    // Test
    result := service.DoSomething(config)
    
    // Assert
    assert.NotNil(t, result)
}
```

**When:** Testing services that interact with MongoDB  
**Example:** `internal/configs/service_test.go`

### Pattern 3: HTTP Handler Test

```go
func TestHandler(t *testing.T) {
    // Setup
    router, handler, cleanup := setupTest(t)
    defer cleanup()
    
    // Make request
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/endpoint", body)
    router.ServeHTTP(w, req)
    
    // Assert
    assert.Equal(t, http.StatusOK, w.Code)
}
```

**When:** Testing HTTP endpoints  
**Example:** `internal/http/handlers/auth_test.go`

## 📋 Essential Commands

```bash
# Run tests
make test              # All tests
make test-unit         # Unit tests only (fast)
make test-integration  # Integration tests only

# Coverage
make test-coverage     # Generate report
make coverage-html     # View in browser

# Debug
go test -v ./internal/auth/...           # Verbose, specific package
go test -run TestLogin ./...             # Specific test
make test-race                           # Race detector

# Clean
make clean            # Clear test cache
```

## 🔧 Essential Imports

```go
import (
    "testing"
    "context"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    
    "your.module/config-manager/tests/fixtures"
    "your.module/config-manager/tests/testutil"
)
```

## 📦 Using Fixtures

```go
// Users
user := fixtures.AdminUser()
user := fixtures.RegularUser()

// Configs
config := fixtures.ProductConfig("Name")
config := fixtures.InstanceConfig("Name", parentID)
config := fixtures.UserConfig("Name", parentID, username)

// Rules
rule := fixtures.NumericRule(configID, "path", "greater", 50)
rule := fixtures.PatternRule(configID, "path", "^[A-Z]+$")
rule := fixtures.CollectionRule(configID, "path", []interface{}{"a", "b"})
```

## ✅ Test Naming Convention

```go
Test<FunctionName>_<Scenario>_<ExpectedResult>

// Examples:
TestLogin_ValidCredentials_ReturnsToken
TestResolve_MultiLevelInheritance_MergesCorrectly
TestAuth_ExpiredToken_ReturnsUnauthorized
```

## 🎨 Assert vs Require

```go
// Use REQUIRE for critical checks (stops test on failure)
require.NoError(t, err)
require.NotNil(t, user)

// Use ASSERT for non-critical checks (continues test)
assert.Equal(t, expected, actual)
assert.True(t, condition)
assert.Len(t, slice, 3)
```

## 📊 Coverage Goals

| Component | Target |
|-----------|--------|
| Services | 90%+ |
| Handlers | 80%+ |
| Middleware | 90%+ |
| **Overall** | **80%+** |

## 🏃 Implementation Order

1. **Week 1**: Service unit tests (highest priority)
2. **Week 2**: Handler tests
3. **Week 3**: Integration tests
4. **Week 4**: CI/CD + cleanup

## 🎓 Learning Path

**New to Go testing?**
1. Read: `internal/auth/jwt_test.go` (simplest)
2. Copy the pattern
3. Write your first test
4. Run: `make test`

**Ready for more?**
1. Study: `internal/rules/service_test.go` (table-driven)
2. Study: `internal/http/handlers/auth_test.go` (HTTP)
3. Read: [TESTING_README.md](./TESTING_README.md)

**Want the full picture?**
Read: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

## ⚡ Table-Driven Test Template

```go
func TestFeature(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    string
        wantErr bool
    }{
        {"valid case", "input1", "output1", false},
        {"error case", "bad", "", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Function(tt.input)
            
            if tt.wantErr {
                assert.Error(t, err)
                return
            }
            
            require.NoError(t, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

## 🐛 Common Mistakes

❌ **Don't**: Test the framework
```go
func TestGinReturnsJSON(t *testing.T) // Bad!
```

❌ **Don't**: Forget cleanup
```go
db, _ := testutil.SetupTestDB(t) // Missing defer cleanup()!
```

❌ **Don't**: Make tests dependent
```go
// TestB depends on TestA running first - BAD!
```

✅ **Do**: Test your business logic
```go
func TestResolve_MultiLevel_MergesCorrectly(t *testing.T) // Good!
```

✅ **Do**: Always cleanup
```go
db, cleanup := testutil.SetupTestDB(t)
defer cleanup() // Good!
```

✅ **Do**: Make tests independent
```go
// Each test can run alone - GOOD!
```

## 🆘 Troubleshooting

| Error | Fix |
|-------|-----|
| "MongoDB connection refused" | `docker run -d -p 27017:27017 mongo:7` |
| "Cannot import fixtures" | `go mod tidy` |
| "Test timeout" | Increase: `go test ./... -timeout 60s` |
| "Test cache" | `make clean` |

## 📚 Where to Find Help

| Question | Answer |
|----------|--------|
| How do I run tests? | This page, or `make help` |
| What tests exist? | [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) |
| How do I write tests? | Example files, or [TESTING_README.md](./TESTING_README.md) |
| What's the strategy? | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) |
| Where do I start? | [TESTING_INDEX.md](./TESTING_INDEX.md) |

## ✨ Pro Tips

1. **Write tests first** (TDD) - It's easier!
2. **Use fixtures** - Don't repeat test data
3. **Use table-driven tests** - Test multiple cases easily
4. **Always defer cleanup** - Prevent resource leaks
5. **Use descriptive names** - Future you will thank you
6. **Test errors too** - Don't just test happy path
7. **Keep tests fast** - Under 1 minute for full suite
8. **Run tests often** - Before every commit
9. **Use `-v` flag** - When debugging
10. **Mock external APIs** - Don't call real services

## 🎯 Your Action Items

- [ ] Read this page (you're doing it! ✅)
- [ ] Run `make install-deps`
- [ ] Run `make test` to verify setup
- [ ] Read one example test file
- [ ] Copy a pattern and write your first test
- [ ] Read [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) for next steps

## 🔗 Quick Links

- 📖 [TESTING_INDEX.md](./TESTING_INDEX.md) - Complete navigation
- 📖 [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) - What's done & next
- 📖 [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Detailed strategy
- 📖 [TESTING_README.md](./TESTING_README.md) - How-to guide
- 🔧 [Makefile](./Makefile) - All commands

---

**Remember:** Tests are documentation that never lies! 🎯

**Status:** 🟢 Ready to implement  
**Last Updated:** {{DATE}}


