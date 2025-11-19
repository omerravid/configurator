package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"your.module/config-manager/internal/auth"
	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/http/middleware"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/fixtures"
	"your.module/config-manager/tests/testutil"
)

// Example of HTTP handler test using real database and HTTP testing

func setupAuthTest(t *testing.T) (*gin.Engine, *AuthHandler, func()) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	db, cleanupDB := testutil.SetupTestDB(t)

	cfg := config.Config{
		JWTSecret: "test-secret",
		APIKey:    "test-api-key",
	}

	log := logger.New(logger.InfoLevel)

	handler := NewAuthHandler(cfg, db, log)

	router := gin.New()

	// Use actual auth middleware for protected routes
	authMiddleware := middleware.Auth(middleware.AuthConfig{
		JWTSecret: cfg.JWTSecret,
		APIKey:    cfg.APIKey,
	})

	handler.Register(router, authMiddleware)

	cleanup := func() {
		cleanupDB()
		log.Sync()
	}

	return router, handler, cleanup
}

func TestLogin_ValidCredentials_ReturnsToken(t *testing.T) {
	// Arrange
	router, handler, cleanup := setupAuthTest(t)
	defer cleanup()

	// Insert a test user
	user := fixtures.AdminUser()
	_, err := handler.db.Users.InsertOne(context.Background(), user)
	require.NoError(t, err)

	loginReq := types.LoginRequest{
		Username: "admin",
		Password: "admin123",
	}
	body, _ := json.Marshal(loginReq)

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response types.AuthResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "Login successful", response.Message)
	assert.NotEmpty(t, response.Token, "Token should not be empty")

	// Verify token is valid
	assert.NotNil(t, response.User)
}

func TestLogin_InvalidCredentials_ReturnsUnauthorized(t *testing.T) {
	// Table-driven test for different failure scenarios
	tests := []struct {
		name           string
		username       string
		password       string
		setupUser      bool
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "wrong password",
			username:       "admin",
			password:       "wrong-password",
			setupUser:      true,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid username or password",
		},
		{
			name:           "user not found",
			username:       "nonexistent",
			password:       "any-password",
			setupUser:      false,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid username or password",
		},
		{
			name:           "empty password",
			username:       "admin",
			password:       "",
			setupUser:      true,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid request",
		},
		{
			name:           "empty username",
			username:       "",
			password:       "password",
			setupUser:      false,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid request",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			router, handler, cleanup := setupAuthTest(t)
			defer cleanup()

			if tt.setupUser {
				user := fixtures.AdminUser()
				_, _ = handler.db.Users.InsertOne(context.Background(), user)
			}

			loginReq := types.LoginRequest{
				Username: tt.username,
				Password: tt.password,
			}
			body, _ := json.Marshal(loginReq)

			// Act
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &response)
			assert.Contains(t, response["error"], tt.expectedError)
		})
	}
}

func TestRegister_ValidRequest_CreatesUser(t *testing.T) {
	// Arrange
	router, _, cleanup := setupAuthTest(t)
	defer cleanup()

	registerReq := types.RegisterRequest{
		Username: "newuser",
		Password: "password123",
		Role:     types.RoleUser,
	}
	body, _ := json.Marshal(registerReq)

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusCreated, w.Code)

	var response types.AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "User registered successfully", response.Message)
	assert.NotEmpty(t, response.Token)
}

func TestRegister_DuplicateUsername_ReturnsConflict(t *testing.T) {
	// Arrange
	router, handler, cleanup := setupAuthTest(t)
	defer cleanup()

	// Insert existing user
	user := fixtures.RegularUser()
	_, err := handler.db.Users.InsertOne(context.Background(), user)
	require.NoError(t, err)

	// Try to register with same username
	registerReq := types.RegisterRequest{
		Username: user.Username,
		Password: "password123",
		Role:     types.RoleUser,
	}
	body, _ := json.Marshal(registerReq)

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusConflict, w.Code)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	assert.Contains(t, response["error"], "already exists")
}

func TestRegister_InvalidInput_ReturnsBadRequest(t *testing.T) {
	tests := []struct {
		name     string
		username string
		password string
		role     types.Role
	}{
		{"short username", "ab", "password123", types.RoleUser},
		{"short password", "validuser", "12345", types.RoleUser},
		{"empty username", "", "password123", types.RoleUser},
		{"empty password", "validuser", "", types.RoleUser},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			router, _, cleanup := setupAuthTest(t)
			defer cleanup()

			registerReq := types.RegisterRequest{
				Username: tt.username,
				Password: tt.password,
				Role:     tt.role,
			}
			body, _ := json.Marshal(registerReq)

			// Act
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestMe_ValidToken_ReturnsUserInfo(t *testing.T) {
	// Arrange
	router, handler, cleanup := setupAuthTest(t)
	defer cleanup()

	user := fixtures.AdminUser()
	_, err := handler.db.Users.InsertOne(context.Background(), user)
	require.NoError(t, err)

	// Generate a valid token
	token, err := auth.GenerateToken(handler.cfg.JWTSecret, user.ID, user.Username, string(user.Role), 24*time.Hour)
	require.NoError(t, err)

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	userObj := response["user"].(map[string]interface{})
	assert.Equal(t, user.Username, userObj["username"])
	assert.Equal(t, string(user.Role), userObj["role"])
}

func TestMe_NoToken_ReturnsUnauthorized(t *testing.T) {
	// Arrange
	router, _, cleanup := setupAuthTest(t)
	defer cleanup()

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRefresh_ValidToken_ReturnsNewToken(t *testing.T) {
	// Arrange
	router, handler, cleanup := setupAuthTest(t)
	defer cleanup()

	user := fixtures.AdminUser()
	_, err := handler.db.Users.InsertOne(context.Background(), user)
	require.NoError(t, err)

	// Generate initial token
	oldToken, err := auth.GenerateToken(handler.cfg.JWTSecret, user.ID, user.Username, string(user.Role), 24*time.Hour)
	require.NoError(t, err)

	// Wait at least 1 second to ensure new token has different timestamp
	time.Sleep(1 * time.Second)

	// Act
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+oldToken)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	newToken, ok := response["token"].(string)
	assert.True(t, ok, "Response should contain token")
	assert.NotEmpty(t, newToken)
	assert.NotEqual(t, oldToken, newToken, "New token should be different from old token")
}
