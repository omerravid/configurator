# Logger Integration Example

This document shows how to integrate the logger into your handlers step by step.

## Step 1: Update Handler Struct

Add the logger to your handler struct:

```go
type ConfigsHandler struct {
    db      *db.Client
    svc     *configs.Service
    storage *files.StorageManager
    log     *logger.Logger  // Add this
}

func NewConfigsHandler(dbClient *db.Client, storage *files.StorageManager, log *logger.Logger) *ConfigsHandler {
    return &ConfigsHandler{
        db:      dbClient,
        svc:     configs.New(dbClient.Configurations),
        storage: storage,
        log:     log,  // Store logger
    }
}
```

## Step 2: Add Logging to Handler Methods

### Example: Create Handler

```go
func (h *ConfigsHandler) create(c *gin.Context) {
    ctx := c.Request.Context()
    
    // Log the incoming request
    h.log.InfoCtx(ctx, "Creating configuration")
    
    var req types.CreateConfigRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        // Log validation errors
        h.log.WarnCtx(ctx, "Invalid request body",
            logger.Error(err),
            logger.String("endpoint", "create"),
        )
        c.JSON(400, gin.H{"error": "invalid request"})
        return
    }
    
    // Log the configuration details
    h.log.DebugCtx(ctx, "Configuration request validated",
        logger.String("name", req.Name),
        logger.String("type", string(req.Type)),
    )
    
    // ... business logic ...
    
    // Log errors
    if err != nil {
        h.log.ErrorCtx(ctx, "Failed to create configuration",
            logger.Error(err),
            logger.String("name", req.Name),
            logger.String("type", string(req.Type)),
        )
        c.JSON(500, gin.H{"error": "Internal server error"})
        return
    }
    
    // Log success
    h.log.InfoCtx(ctx, "Configuration created successfully",
        logger.String("configId", cfg.ID),
        logger.String("name", cfg.Name),
        logger.String("type", string(cfg.Type)),
        logger.String("createdBy", cfg.CreatedBy),
    )
    
    c.JSON(201, cfg)
}
```

### Example: Update Handler

```go
func (h *ConfigsHandler) update(c *gin.Context) {
    ctx := c.Request.Context()
    id := c.Param("id")
    
    h.log.InfoCtx(ctx, "Updating configuration",
        logger.String("configId", id),
    )
    
    var req types.UpdateConfigRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        h.log.WarnCtx(ctx, "Invalid update request",
            logger.Error(err),
            logger.String("configId", id),
        )
        c.JSON(400, gin.H{"error": "invalid request"})
        return
    }
    
    // Get existing config
    existingCfg, err := h.getConfigByID(ctx, id)
    if err != nil {
        h.log.ErrorCtx(ctx, "Configuration not found",
            logger.String("configId", id),
            logger.Error(err),
        )
        c.JSON(404, gin.H{"error": "Configuration not found"})
        return
    }
    
    h.log.DebugCtx(ctx, "Existing configuration loaded",
        logger.String("configId", id),
        logger.String("name", existingCfg.Name),
    )
    
    // Update logic...
    
    h.log.InfoCtx(ctx, "Configuration updated successfully",
        logger.String("configId", id),
        logger.String("name", existingCfg.Name),
    )
    
    c.JSON(200, updatedCfg)
}
```

### Example: Delete Handler

```go
func (h *ConfigsHandler) delete(c *gin.Context) {
    ctx := c.Request.Context()
    id := c.Param("id")
    
    h.log.InfoCtx(ctx, "Deleting configuration",
        logger.String("configId", id),
    )
    
    result, err := h.db.Configurations.DeleteOne(ctx, bson.M{"_id": oid})
    if err != nil {
        h.log.ErrorCtx(ctx, "Failed to delete configuration",
            logger.String("configId", id),
            logger.Error(err),
        )
        c.JSON(500, gin.H{"error": "Internal server error"})
        return
    }
    
    if result.DeletedCount == 0 {
        h.log.WarnCtx(ctx, "Configuration not found for deletion",
            logger.String("configId", id),
        )
        c.JSON(404, gin.H{"error": "Configuration not found"})
        return
    }
    
    h.log.InfoCtx(ctx, "Configuration deleted successfully",
        logger.String("configId", id),
    )
    
    c.JSON(200, gin.H{"message": "Configuration deleted"})
}
```

## Step 3: Update Router to Pass Logger

```go
func NewRouter(cfg config.Config, log *logger.Logger, mc *mongo.Client) *gin.Engine {
    r := gin.New()
    r.Use(gin.Logger(), gin.Recovery())

    // ... auth middleware ...

    api := r.Group("/api", authMw)
    requireAdmin := middleware.RequireAdmin()
    checkConfigPerms := middleware.CheckConfigPermissions(mc)

    // Pass logger to handlers
    uh := handlers.NewUsersHandler(mc, log)
    uh.Register(api, requireAdmin)

    // Files & Storage
    storageMgr, err := files.NewStorageManager(cfg)
    if err != nil {
        log.Errorf("Failed to initialize storage: %v", err)
        storageMgr = nil
    }

    // Pass logger to configs handler
    ch := handlers.NewConfigsHandler(mc, storageMgr, log)
    ch.Register(api, checkConfigPerms, requireAdmin)

    // Pass logger to rules handler
    rh := handlers.NewRulesHandler(mc, log)
    rh.Register(api)

    // ... etc for other handlers
    
    return r
}
```

## Step 4: Add Request Logging Middleware (Optional)

Create a middleware to log all HTTP requests:

```go
// internal/http/middleware/logging.go
package middleware

import (
    "time"
    
    "github.com/gin-gonic/gin"
    "your.module/config-manager/internal/logger"
)

func RequestLogger(log *logger.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        method := c.Request.Method
        
        // Process request
        c.Next()
        
        // Log after request
        latency := time.Since(start)
        statusCode := c.Writer.Status()
        clientIP := c.ClientIP()
        
        // Choose log level based on status code
        if statusCode >= 500 {
            log.Error("HTTP request",
                logger.String("method", method),
                logger.String("path", path),
                logger.Int("status", statusCode),
                logger.Duration("latency", latency),
                logger.String("ip", clientIP),
            )
        } else if statusCode >= 400 {
            log.Warn("HTTP request",
                logger.String("method", method),
                logger.String("path", path),
                logger.Int("status", statusCode),
                logger.Duration("latency", latency),
                logger.String("ip", clientIP),
            )
        } else {
            log.Info("HTTP request",
                logger.String("method", method),
                logger.String("path", path),
                logger.Int("status", statusCode),
                logger.Duration("latency", latency),
                logger.String("ip", clientIP),
            )
        }
    }
}
```

Then use it in your router:

```go
func NewRouter(cfg config.Config, log *logger.Logger, mc *mongo.Client) *gin.Engine {
    r := gin.New()
    
    // Replace gin.Logger() with custom logger
    r.Use(RequestLogger(log))
    r.Use(gin.Recovery())
    
    // ... rest of router setup
}
```

## Step 5: Add Context Enrichment (Optional)

Add request IDs and user info to context for better tracing:

```go
// internal/http/middleware/context.go
package middleware

import (
    "context"
    
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

func ContextEnrichment() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Add request ID
        requestID := uuid.New().String()
        ctx := context.WithValue(c.Request.Context(), "requestId", requestID)
        
        // Add to response header for client tracking
        c.Header("X-Request-ID", requestID)
        
        // Update request context
        c.Request = c.Request.WithContext(ctx)
        
        c.Next()
    }
}
```

Update auth middleware to add user info to context:

```go
func Auth(authCfg AuthConfig) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... existing auth logic ...
        
        if err == nil && token.Valid {
            c.Set("user", claims)
            
            // Add to context for logger
            ctx := c.Request.Context()
            if userId, ok := claims["userId"].(string); ok {
                ctx = context.WithValue(ctx, "userId", userId)
            }
            if username, ok := claims["username"].(string); ok {
                ctx = context.WithValue(ctx, "username", username)
            }
            c.Request = c.Request.WithContext(ctx)
            
            c.Next()
            return
        }
        
        // ... rest of auth logic
    }
}
```

## Complete Example: Users Handler

```go
package handlers

import (
    "context"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"

    "your.module/config-manager/internal/logger"
    "your.module/config-manager/internal/mongo"
    "your.module/config-manager/internal/types"
)

type UsersHandler struct {
    db  *mongo.Client
    log *logger.Logger
}

func NewUsersHandler(db *mongo.Client, log *logger.Logger) *UsersHandler {
    return &UsersHandler{
        db:  db,
        log: log,
    }
}

func (h *UsersHandler) Register(api *gin.RouterGroup, requireAdmin gin.HandlerFunc) {
    users := api.Group("/users", requireAdmin)
    {
        users.GET("", h.listUsers)
        users.GET("/:id", h.getUser)
        users.PUT("/:id/role", h.updateUserRole)
        users.DELETE("/:id", h.deleteUser)
        users.GET("/:id/configurations", h.getUserConfigurations)
    }
}

func (h *UsersHandler) listUsers(c *gin.Context) {
    ctx := c.Request.Context()
    
    h.log.InfoCtx(ctx, "Listing users")
    
    cur, err := h.db.Users.Find(ctx, bson.M{})
    if err != nil {
        h.log.ErrorCtx(ctx, "Failed to query users",
            logger.Error(err),
        )
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }
    defer cur.Close(ctx)

    var users []types.User
    for cur.Next(ctx) {
        var u types.User
        if err := cur.Decode(&u); err == nil {
            users = append(users, u)
        }
    }
    
    h.log.InfoCtx(ctx, "Users listed successfully",
        logger.Int("count", len(users)),
    )
    
    c.JSON(http.StatusOK, gin.H{"users": users})
}

func (h *UsersHandler) deleteUser(c *gin.Context) {
    ctx := c.Request.Context()
    id := c.Param("id")
    
    h.log.InfoCtx(ctx, "Deleting user",
        logger.String("targetUserId", id),
    )
    
    oid, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        h.log.WarnCtx(ctx, "Invalid user ID format",
            logger.String("userId", id),
            logger.Error(err),
        )
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
        return
    }

    // Get current user from context
    claims, exists := c.Get("user")
    if !exists {
        h.log.ErrorCtx(ctx, "User context not found")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
        return
    }

    var claimsMap map[string]any
    claimsMap, ok := claims.(map[string]any)
    if !ok {
        if jwtClaims, ok := claims.(jwt.MapClaims); ok {
            claimsMap = map[string]any(jwtClaims)
        } else {
            h.log.ErrorCtx(ctx, "Invalid user context type")
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context type"})
            return
        }
    }

    currentUserID, _ := claimsMap["userId"].(string)

    // Prevent self-deletion
    if currentUserID == id {
        h.log.WarnCtx(ctx, "Attempted self-deletion",
            logger.String("userId", id),
        )
        c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
        return
    }

    result, err := h.db.Users.DeleteOne(ctx, bson.M{"_id": oid})
    if err != nil {
        h.log.ErrorCtx(ctx, "Failed to delete user",
            logger.String("userId", id),
            logger.Error(err),
        )
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
        return
    }

    if result.DeletedCount == 0 {
        h.log.WarnCtx(ctx, "User not found for deletion",
            logger.String("userId", id),
        )
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    h.log.InfoCtx(ctx, "User deleted successfully",
        logger.String("userId", id),
        logger.String("deletedBy", currentUserID),
    )
    
    c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
```

## Best Practices Summary

1. **Always use `*Ctx` methods** in HTTP handlers to include request context
2. **Log at appropriate levels**:
   - `Debug`: Detailed information for debugging
   - `Info`: Normal operations and success cases
   - `Warn`: Validation errors, not-found cases
   - `Error`: Actual errors that need attention
3. **Include relevant fields**: IDs, names, operations, errors
4. **Don't log sensitive data**: passwords, tokens, full request bodies
5. **Use structured fields** instead of string formatting
6. **Create child loggers** for persistent fields across multiple operations

## Testing Your Logs

After integration, test with different log levels:

```bash
# Debug level (very verbose)
LOG_LEVEL=debug docker-compose up

# Info level (normal)
LOG_LEVEL=info docker-compose up

# Error level (only errors)
LOG_LEVEL=error docker-compose up
```

View logs:

```bash
docker-compose logs -f api-go
```

