package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"your.module/config-manager/internal/auth"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/fixtures"
	"your.module/config-manager/tests/testutil"
)

// Example of middleware tests using HTTP test helpers

func setupAuthMiddlewareTest(t *testing.T) (*gin.Engine, AuthConfig, func()) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	authCfg := AuthConfig{
		JWTSecret: "test-secret",
		APIKey:    "test-api-key",
	}

	router := gin.New()
	
	return router, authCfg, func() {}
}

func TestAuth_ValidJWTToken_SetsUserContext(t *testing.T) {
	// Arrange
	router, authCfg, cleanup := setupAuthMiddlewareTest(t)
	defer cleanup()

	user := fixtures.AdminUser()
	token, err := auth.GenerateToken(authCfg.JWTSecret, user.ID, user.Username, string(user.Role), 24*time.Hour)
	require.NoError(t, err)

	router.GET("/test", Auth(authCfg), func(c *gin.Context) {
		userCtx, exists := c.Get("user")
		assert.True(t, exists)
		c.JSON(http.StatusOK, gin.H{"user": userCtx})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAuth_InvalidJWTToken_ReturnsUnauthorized(t *testing.T) {
	// Table-driven test for various invalid token scenarios
	tests := []struct {
		name  string
		token string
	}{
		{"malformed token", "invalid.token.here"},
		{"expired token", generateExpiredToken(t)},
		{"wrong secret", generateTokenWithWrongSecret(t)},
		{"empty token", ""},
		{"no Bearer prefix", "justTheToken"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			router, authCfg, cleanup := setupAuthMiddlewareTest(t)
			defer cleanup()

			router.GET("/test", Auth(authCfg), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true})
			})

			// Act
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestAuth_ValidAPIKey_SetsUserContext(t *testing.T) {
	// Arrange
	router, authCfg, cleanup := setupAuthMiddlewareTest(t)
	defer cleanup()

	router.GET("/test", Auth(authCfg), func(c *gin.Context) {
		userCtx, exists := c.Get("user")
		assert.True(t, exists)
		
		userMap := userCtx.(map[string]interface{})
		assert.Equal(t, "api-service", userMap["username"])
		assert.Equal(t, "ADMIN", userMap["role"])
		assert.True(t, userMap["isApiKey"].(bool))
		
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", authCfg.APIKey)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAuth_InvalidAPIKey_ReturnsUnauthorized(t *testing.T) {
	// Arrange
	router, authCfg, cleanup := setupAuthMiddlewareTest(t)
	defer cleanup()

	router.GET("/test", Auth(authCfg), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "wrong-api-key")
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_NoAuthentication_ReturnsUnauthorized(t *testing.T) {
	// Arrange
	router, authCfg, cleanup := setupAuthMiddlewareTest(t)
	defer cleanup()

	router.GET("/test", Auth(authCfg), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireAdmin_AdminRole_Allows(t *testing.T) {
	// Arrange
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.GET("/admin", RequireAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Mock user context with admin role
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "admin-123",
			"username": "admin",
			"role":     "ADMIN",
		})
		c.Next()
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequireAdmin_UserRole_ReturnsForbidden(t *testing.T) {
	// Arrange
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Mock user context with user role
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "user-123",
			"username": "regularuser",
			"role":     "USER",
		})
		c.Next()
	})

	router.GET("/admin", RequireAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRequireAdmin_NoUserContext_ReturnsUnauthorized(t *testing.T) {
	// Arrange
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.GET("/admin", RequireAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act (no user context set)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestCheckConfigPermissions_AdminUser_AllowsAnyConfig(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create a config
	config := fixtures.ProductConfig("TestProduct")
	_, err := db.Configurations.InsertOne(context.Background(), config)
	require.NoError(t, err)

	// Set up admin user context
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "admin-123",
			"username": "admin",
			"role":     "ADMIN",
		})
		c.Next()
	})

	router.PUT("/configs/:id", CheckConfigPermissions(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPUT, "/configs/"+config.ID, nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCheckConfigPermissions_UserModifyingOwnConfig_Allows(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	username := "testuser"

	// Create a USER config owned by the user
	config := fixtures.UserConfig("UserConfig", "parent-id", username)
	_, err := db.Configurations.InsertOne(context.Background(), config)
	require.NoError(t, err)

	// Set up user context
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "user-123",
			"username": username,
			"role":     "USER",
		})
		c.Next()
	})

	router.PUT("/configs/:id", CheckConfigPermissions(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPUT, "/configs/"+config.ID, nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCheckConfigPermissions_UserModifyingOthersConfig_ReturnsForbidden(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create a USER config owned by someone else
	config := fixtures.UserConfig("UserConfig", "parent-id", "otheruser")
	_, err := db.Configurations.InsertOne(context.Background(), config)
	require.NoError(t, err)

	// Set up different user context
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "user-123",
			"username": "testuser",
			"role":     "USER",
		})
		c.Next()
	})

	router.PUT("/configs/:id", CheckConfigPermissions(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPUT, "/configs/"+config.ID, nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestCheckConfigPermissions_UserModifyingProductConfig_ReturnsForbidden(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create a PRODUCT config (only admins can modify)
	config := fixtures.ProductConfig("TestProduct")
	_, err := db.Configurations.InsertOne(context.Background(), config)
	require.NoError(t, err)

	// Set up regular user context
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "user-123",
			"username": "testuser",
			"role":     "USER",
		})
		c.Next()
	})

	router.PUT("/configs/:id", CheckConfigPermissions(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPUT, "/configs/"+config.ID, nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestCheckConfigPermissions_ModifyingCommittedConfig_ReturnsForbidden(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	username := "testuser"

	// Create a USER config that's already committed
	config := fixtures.UserConfig("UserConfig", "parent-id", username)
	config.Status = types.StatusCommitted
	_, err := db.Configurations.InsertOne(context.Background(), config)
	require.NoError(t, err)

	// Set up user context
	router.Use(func(c *gin.Context) {
		c.Set("user", map[string]interface{}{
			"userId":   "user-123",
			"username": username,
			"role":     "USER",
		})
		c.Next()
	})

	router.PUT("/configs/:id", CheckConfigPermissions(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPUT, "/configs/"+config.ID, nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// Helper functions

func generateExpiredToken(t *testing.T) string {
	t.Helper()
	token, _ := auth.GenerateToken("test-secret", "user123", "testuser", "USER", -1*time.Hour)
	return token
}

func generateTokenWithWrongSecret(t *testing.T) string {
	t.Helper()
	token, _ := auth.GenerateToken("wrong-secret", "user123", "testuser", "USER", 1*time.Hour)
	return token
}

