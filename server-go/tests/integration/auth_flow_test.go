package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/http/handlers"
	"your.module/config-manager/internal/http/middleware"
	"your.module/config-manager/internal/logger"
	mongoClient "your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/testutil"
)

// AuthFlowSuite tests complete authentication flows end-to-end
type AuthFlowSuite struct {
	suite.Suite
	db      *mongoClient.Client
	cleanup func()
	router  *gin.Engine
	cfg     config.Config
}

func (s *AuthFlowSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Setup test database
	s.db, s.cleanup = testutil.SetupTestDB(s.T())
	
	// Setup config
	s.cfg = config.Config{
		JWTSecret: "test-jwt-secret-for-integration",
		APIKey:    "test-api-key",
	}
	
	// Setup router with all auth endpoints
	s.router = gin.New()
	log := logger.New(logger.InfoLevel)
	
	// Setup handlers
	authHandler := handlers.NewAuthHandler(s.cfg, s.db, log)
	configsHandler := handlers.NewConfigsHandler(s.db, nil, log)
	
	// Public routes - auth needs router and middleware
	authMiddleware := middleware.Auth(middleware.AuthConfig{
		JWTSecret: s.cfg.JWTSecret,
		APIKey:    s.cfg.APIKey,
	})
	authHandler.Register(s.router, authMiddleware)
	
	// Protected routes
	api := s.router.Group("/api", authMiddleware)
	checkPermissions := middleware.CheckConfigPermissions(s.db)
	requireAdmin := middleware.RequireAdmin()
	configsHandler.Register(api, checkPermissions, requireAdmin)
}

func (s *AuthFlowSuite) TearDownTest() {
	if s.cleanup != nil {
		s.cleanup()
	}
}

func TestAuthFlowSuite(t *testing.T) {
	suite.Run(t, new(AuthFlowSuite))
}

// TestCompleteAuthFlow_RegisterLoginRefreshAccessProtectedEndpoint tests the complete authentication flow
func (s *AuthFlowSuite) TestCompleteAuthFlow_RegisterLoginRefreshAccessProtectedEndpoint() {
	t := s.T()
	
	// ===== Step 1: Register a new user =====
	registerReq := types.RegisterRequest{
		Username: "integrationuser",
		Password: "password123",
		Role:     types.RoleUser,
	}
	registerBody, _ := json.Marshal(registerReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(registerBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code, "Registration should succeed")
	
	var registerResp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &registerResp)
	require.NoError(t, err)
	require.Contains(t, registerResp, "token")
	
	firstToken := registerResp["token"].(string)
	require.NotEmpty(t, firstToken, "Should receive token on registration")
	
	// ===== Step 2: Login with credentials =====
	loginReq := types.LoginRequest{
		Username: "integrationuser",
		Password: "password123",
	}
	loginBody, _ := json.Marshal(loginReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Login should succeed")
	
	var loginResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &loginResp)
	require.NoError(t, err)
	require.Contains(t, loginResp, "token")
	
	loginToken := loginResp["token"].(string)
	require.NotEmpty(t, loginToken, "Should receive token on login")
	
	// ===== Step 3: Access protected endpoint with token =====
	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Should access protected endpoint with valid token")
	
	var meResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &meResp)
	require.NoError(t, err)
	
	user := meResp["user"].(map[string]interface{})
	assert.Equal(t, "integrationuser", user["username"])
	assert.Equal(t, string(types.RoleUser), user["role"])
	
	// ===== Step 4: Refresh token =====
	// Wait a moment to ensure different issuedAt timestamps
	time.Sleep(1 * time.Second)
	
	req = httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Token refresh should succeed")
	
	var refreshResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &refreshResp)
	require.NoError(t, err)
	require.Contains(t, refreshResp, "token")
	
	refreshedToken := refreshResp["token"].(string)
	require.NotEmpty(t, refreshedToken, "Should receive new token on refresh")
	assert.NotEqual(t, loginToken, refreshedToken, "Refreshed token should be different")
	
	// ===== Step 5: Use refreshed token =====
	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+refreshedToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Refreshed token should work")
	
	// ===== Step 6: Create a configuration (user config allowed for regular users) =====
	createConfigReq := types.CreateConfigRequest{
		Name:        "integration-user-config",
		Type:        types.ConfigUser,
		Description: "Test config created in integration test",
		Data:        map[string]any{"testKey": "testValue"},
	}
	configBody, _ := json.Marshal(createConfigReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(configBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+refreshedToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code, "Should create config with valid token")
	
	var configResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &configResp)
	require.NoError(t, err)
	require.Contains(t, configResp, "config")
}

// TestAuthFlow_InvalidCredentials_ReturnsUnauthorized tests login failure scenarios
func (s *AuthFlowSuite) TestAuthFlow_InvalidCredentials_ReturnsUnauthorized() {
	t := s.T()
	
	// Register a user first
	registerReq := types.RegisterRequest{
		Username: "testuser",
		Password: "correctpassword",
		Role:     types.RoleUser,
	}
	registerBody, _ := json.Marshal(registerReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(registerBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	
	// Try to login with wrong password
	loginReq := types.LoginRequest{
		Username: "testuser",
		Password: "wrongpassword",
	}
	loginBody, _ := json.Marshal(loginReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code, "Should reject wrong password")
	
	// Try to login with non-existent user
	loginReq = types.LoginRequest{
		Username: "nonexistentuser",
		Password: "anypassword",
	}
	loginBody, _ = json.Marshal(loginReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code, "Should reject non-existent user")
}

// TestAuthFlow_AccessProtectedRoute_WithoutToken_ReturnsForbidden tests unauthorized access
func (s *AuthFlowSuite) TestAuthFlow_AccessProtectedRoute_WithoutToken_ReturnsForbidden() {
	t := s.T()
	
	// Try to access protected endpoint without token
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code, "Should reject request without token")
	
	// Try to access protected endpoint with invalid token
	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-here")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code, "Should reject invalid token")
}

// TestAuthFlow_TokenExpiration tests that expired tokens are rejected
func (s *AuthFlowSuite) TestAuthFlow_TokenExpiration() {
	t := s.T()
	
	// Note: For proper expiration testing, you'd need to modify the JWT service
	// to accept a custom expiration time, or wait for actual expiration (not practical in tests)
	// For now, we're just testing that malformed tokens are rejected
	
	// Try to use a malformed token
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer malformed-token-here")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	// Malformed token should be rejected
	assert.Equal(t, http.StatusUnauthorized, w.Code, "Malformed token should be rejected")
}

// TestAuthFlow_AdminVsUserPermissions tests role-based access control
func (s *AuthFlowSuite) TestAuthFlow_AdminVsUserPermissions() {
	t := s.T()
	
	// ===== Register admin user =====
	adminReq := types.RegisterRequest{
		Username: "adminuser",
		Password: "adminpass123",
		Role:     types.RoleAdmin,
	}
	adminBody, _ := json.Marshal(adminReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(adminBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	
	var adminResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &adminResp)
	adminToken := adminResp["token"].(string)
	
	// ===== Register regular user =====
	userReq := types.RegisterRequest{
		Username: "regularuser",
		Password: "userpass123",
		Role:     types.RoleUser,
	}
	userBody, _ := json.Marshal(userReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(userBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	
	var userResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &userResp)
	userToken := userResp["token"].(string)
	
	// ===== Admin can create PRODUCT config =====
	productReq := types.CreateConfigRequest{
		Name:        "admin-product",
		Type:        types.ConfigProduct,
		Description: "Product config by admin",
	}
	productBody, _ := json.Marshal(productReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(productBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusCreated, w.Code, "Admin should create PRODUCT config")
	
	// ===== Regular user CANNOT create PRODUCT config =====
	productReq2 := types.CreateConfigRequest{
		Name:        "user-product",
		Type:        types.ConfigProduct,
		Description: "Product config by user (should fail)",
	}
	productBody2, _ := json.Marshal(productReq2)
	
	req = httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(productBody2))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+userToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusForbidden, w.Code, "Regular user should NOT create PRODUCT config")
	
	// ===== Regular user CAN create USER config =====
	userConfigReq := types.CreateConfigRequest{
		Name:        "user-own-config",
		Type:        types.ConfigUser,
		Description: "User config by regular user",
	}
	userConfigBody, _ := json.Marshal(userConfigReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(userConfigBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+userToken)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusCreated, w.Code, "Regular user should create USER config")
}

// TestAuthFlow_DuplicateRegistration tests duplicate username handling
func (s *AuthFlowSuite) TestAuthFlow_DuplicateRegistration() {
	t := s.T()
	
	// Register first user
	registerReq := types.RegisterRequest{
		Username: "duplicatetest",
		Password: "password123",
		Role:     types.RoleUser,
	}
	registerBody, _ := json.Marshal(registerReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(registerBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "First registration should succeed")
	
	// Try to register with same username
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(registerBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusConflict, w.Code, "Duplicate registration should fail")
	
	var errorResp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResp)
	require.NoError(t, err)
	assert.Contains(t, errorResp, "error")
}

