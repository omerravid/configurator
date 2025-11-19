# Logger Package

A structured logging package built on top of [Uber's Zap](https://github.com/uber-go/zap) with context support and Docker-friendly output.

## Features

- ✅ **Multiple Log Levels**: Debug, Info, Warn, Error, Fatal
- ✅ **Context Support**: Extract and log contextual information (request IDs, user IDs, etc.)
- ✅ **Docker-Friendly**: Logs to stdout (captured by Docker logging drivers)
- ✅ **Structured Logging**: JSON-structured logs for easy parsing and analysis
- ✅ **Colored Output**: Human-readable colored console output
- ✅ **Performance**: Built on Zap, one of the fastest Go logging libraries

## Configuration

Set the log level via environment variable:

```bash
# Options: debug, info, warn, error
export LOG_LEVEL=info
```

Or in `docker-compose.yml`:

```yaml
environment:
  - LOG_LEVEL=debug
```

## Usage

### Basic Logging

```go
package main

import (
    "your.module/config-manager/internal/logger"
)

func main() {
    log := logger.New(logger.InfoLevel)
    defer log.Sync()

    // Simple messages
    log.Info("Server started")
    log.Warn("Deprecated API called")
    log.Error("Failed to connect to database")

    // With structured fields
    log.Info("User logged in",
        logger.String("username", "john"),
        logger.String("ip", "192.168.1.1"),
        logger.Int("userId", 123),
    )

    // With error
    err := doSomething()
    if err != nil {
        log.Error("Operation failed",
            logger.Error(err),
            logger.String("operation", "doSomething"),
        )
    }
}
```

### Context-Aware Logging

```go
func handleRequest(ctx context.Context, log *logger.Logger) {
    // Log with context (extracts requestId, userId, username from context)
    log.InfoCtx(ctx, "Processing request")

    // Create a child logger with context fields
    ctxLog := log.WithContext(ctx)
    ctxLog.Info("This will include context fields automatically")

    // Add custom fields to context logger
    ctxLog = ctxLog.With(
        logger.String("action", "create_user"),
        logger.String("resource", "users"),
    )
    ctxLog.Info("Creating user") // Includes action and resource fields
}
```

### Formatted Logging (Printf-style)

```go
// For quick debugging (less performant than structured logging)
log.Infof("User %s logged in from %s", username, ipAddress)
log.Debugf("Processing %d items", count)
log.Errorf("Failed to process item %d: %v", itemId, err)
```

### All Log Levels

```go
// Debug - detailed information for debugging
log.Debug("Cache hit", logger.String("key", "user:123"))

// Info - general informational messages
log.Info("Server started", logger.Int("port", 8080))

// Warn - warning messages for potentially harmful situations
log.Warn("High memory usage", logger.Float64("memoryMB", 1024.5))

// Error - error messages for failures
log.Error("Database connection failed", logger.Error(err))

// Fatal - critical errors that cause the application to exit
log.Fatal("Cannot start server", logger.Error(err))
```

### Available Field Types

```go
logger.String("key", "value")
logger.Int("count", 42)
logger.Int64("bigNumber", 9223372036854775807)
logger.Float64("price", 19.99)
logger.Bool("isActive", true)
logger.Error(err)
logger.Any("data", complexObject)
logger.Duration("elapsed", time.Since(start))
logger.Time("timestamp", time.Now())
logger.Strings("tags", []string{"go", "logging"})
logger.Ints("scores", []int{1, 2, 3})
```

## Context Integration

The logger automatically extracts the following fields from context if present:

- `requestId` - Unique request identifier
- `userId` - Authenticated user ID
- `username` - Authenticated username

### Setting Context Values

```go
// In your middleware
ctx = context.WithValue(ctx, "requestId", uuid.New().String())
ctx = context.WithValue(ctx, "userId", user.ID)
ctx = context.WithValue(ctx, "username", user.Username)

// Pass to handlers
handleRequest(ctx, log)
```

## Examples

### HTTP Handler with Logging

```go
func (h *Handler) CreateUser(c *gin.Context) {
    ctx := c.Request.Context()
    
    h.log.InfoCtx(ctx, "Creating new user")
    
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        h.log.ErrorCtx(ctx, "Invalid request body",
            logger.Error(err),
            logger.String("endpoint", "CreateUser"),
        )
        c.JSON(400, gin.H{"error": "invalid request"})
        return
    }
    
    user, err := h.userService.Create(ctx, req)
    if err != nil {
        h.log.ErrorCtx(ctx, "Failed to create user",
            logger.Error(err),
            logger.String("username", req.Username),
        )
        c.JSON(500, gin.H{"error": "internal server error"})
        return
    }
    
    h.log.InfoCtx(ctx, "User created successfully",
        logger.String("userId", user.ID),
        logger.String("username", user.Username),
    )
    
    c.JSON(201, user)
}
```

### Service Layer with Logging

```go
type UserService struct {
    log *logger.Logger
    db  *mongo.Database
}

func (s *UserService) Create(ctx context.Context, req CreateUserRequest) (*User, error) {
    start := time.Now()
    
    s.log.DebugCtx(ctx, "Starting user creation",
        logger.String("username", req.Username),
    )
    
    user := &User{
        ID:       primitive.NewObjectID(),
        Username: req.Username,
        Email:    req.Email,
    }
    
    _, err := s.db.Collection("users").InsertOne(ctx, user)
    if err != nil {
        s.log.ErrorCtx(ctx, "Database insert failed",
            logger.Error(err),
            logger.String("collection", "users"),
        )
        return nil, err
    }
    
    s.log.InfoCtx(ctx, "User created",
        logger.String("userId", user.ID.Hex()),
        logger.Duration("duration", time.Since(start)),
    )
    
    return user, nil
}
```

## Log Output Format

### Console Output (Development)

```
2025-11-17T15:30:45.123Z    INFO    Server started    {"port": 3004, "logLevel": "info"}
2025-11-17T15:30:45.456Z    INFO    User logged in    {"username": "john", "userId": "123", "ip": "192.168.1.1"}
2025-11-17T15:30:46.789Z    ERROR   Database error    {"error": "connection timeout", "operation": "query"}
```

### Docker Logs

Docker automatically captures stdout and makes logs available via:

```bash
# View logs
docker-compose logs -f api-go

# View logs with timestamps
docker-compose logs -f --timestamps api-go

# View last 100 lines
docker-compose logs --tail=100 api-go

# Filter by log level (if using JSON format)
docker-compose logs api-go | grep '"level":"error"'
```

## Best Practices

1. **Use Structured Logging**: Prefer structured fields over formatted strings
   ```go
   // Good
   log.Info("User created", logger.String("username", user.Name))
   
   // Avoid
   log.Infof("User %s created", user.Name)
   ```

2. **Log at Appropriate Levels**:
   - `Debug`: Detailed debugging information
   - `Info`: General informational messages (default)
   - `Warn`: Warning messages that don't prevent operation
   - `Error`: Error messages for failures
   - `Fatal`: Critical errors that require immediate shutdown

3. **Include Context**: Use `*Ctx` methods in request handlers
   ```go
   log.InfoCtx(ctx, "Processing request")
   ```

4. **Add Relevant Fields**: Include fields that help with debugging
   ```go
   log.Error("Operation failed",
       logger.Error(err),
       logger.String("operation", "createUser"),
       logger.String("userId", userID),
       logger.Duration("elapsed", time.Since(start)),
   )
   ```

5. **Don't Log Sensitive Data**: Never log passwords, tokens, or PII
   ```go
   // Bad
   log.Info("User login", logger.String("password", password))
   
   // Good
   log.Info("User login", logger.String("username", username))
   ```

## Performance Considerations

- Zap is designed for high performance
- Structured logging is faster than formatted logging
- Use `Debug` level for verbose logging in development
- Use `Info` or `Warn` level in production
- Fields are type-safe and don't allocate for primitive types

## Integration with Log Aggregation

The logger outputs to stdout, which can be collected by:

- **Docker Logging Drivers**: json-file, syslog, fluentd, etc.
- **Kubernetes**: Logs are automatically collected by kubelet
- **Log Aggregation Tools**: ELK Stack, Splunk, Datadog, CloudWatch, etc.

Example with Docker json-file driver:

```yaml
services:
  api-go:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

