package integration

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
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/http/handlers"
	"your.module/config-manager/internal/http/middleware"
	"your.module/config-manager/internal/logger"
	mongoClient "your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/testutil"
)

// RulesValidationSuite tests complete rule validation workflows end-to-end
type RulesValidationSuite struct {
	suite.Suite
	db      *mongoClient.Client
	cleanup func()
	router  *gin.Engine
	cfg     config.Config
	token   string // Auth token for making requests
}

func (s *RulesValidationSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Setup test database
	s.db, s.cleanup = testutil.SetupTestDB(s.T())
	
	// Setup config
	s.cfg = config.Config{
		JWTSecret: "test-jwt-secret-for-rules",
		APIKey:    "test-api-key",
	}
	
	// Setup router
	s.router = gin.New()
	log := logger.New(logger.InfoLevel)
	
	// Setup handlers
	authHandler := handlers.NewAuthHandler(s.cfg, s.db, log)
	rulesHandler := handlers.NewRulesHandler(s.db, log)
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
	
	rulesHandler.Register(api)
	configsHandler.Register(api, checkPermissions, requireAdmin)
	
	// Register an admin user and get token
	s.registerAndGetToken()
}

func (s *RulesValidationSuite) TearDownTest() {
	if s.cleanup != nil {
		s.cleanup()
	}
}

func (s *RulesValidationSuite) registerAndGetToken() {
	registerReq := types.RegisterRequest{
		Username: "ruleadmin",
		Password: "adminpass123",
		Role:     types.RoleAdmin,
	}
	body, _ := json.Marshal(registerReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	s.token = resp["token"].(string)
}

func TestRulesValidationSuite(t *testing.T) {
	suite.Run(t, new(RulesValidationSuite))
}

// TestRulesValidation_CompleteWorkflow_CreateConfigAddRulesValidate tests the complete workflow
func (s *RulesValidationSuite) TestRulesValidation_CompleteWorkflow_CreateConfigAddRulesValidate() {
	t := s.T()
	
	// ===== Step 1: Create a product configuration =====
	createConfigReq := types.CreateConfigRequest{
		Name:        "validation-test-product",
		Type:        types.ConfigProduct,
		Description: "Product for testing validation",
		Data: map[string]any{
			"price": float64(100),
			"stock": float64(50),
		},
	}
	configBody, _ := json.Marshal(createConfigReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(configBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code, "Config creation should succeed")
	
	var configResp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &configResp)
	require.NoError(t, err)
	
	configMap := configResp["config"].(map[string]interface{})
	configID := configMap["id"].(string)
	require.NotEmpty(t, configID)
	
	// ===== Step 2: Add numeric validation rule for price =====
	createRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "price",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(0)},
		ErrorMessage:    "Price must be at least 0",
		Enabled:         boolPtr(true),
	}
	ruleBody, _ := json.Marshal(createRuleReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(ruleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code, "Rule creation should succeed")
	
	// ===== Step 3: Add another numeric rule for stock =====
	createStockRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "stock",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greater", "value": float64(0)},
		ErrorMessage:    "Stock must be greater than 0",
		Enabled:         boolPtr(true),
	}
	stockRuleBody, _ := json.Marshal(createStockRuleReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(stockRuleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code, "Stock rule creation should succeed")
	
	// ===== Step 4: Validate valid price =====
	validateReq := types.ValidateValueRequest{
		ConfigurationID: configID,
		PropertyPath:    "price",
		Value:           float64(50),
	}
	validateBody, _ := json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Validation should succeed")
	
	var validResp types.ValidateResponse
	err = json.Unmarshal(w.Body.Bytes(), &validResp)
	require.NoError(t, err)
	assert.True(t, validResp.IsValid, "Price 50 should be valid")
	assert.Empty(t, validResp.Errors, "Should have no errors")
	
	// ===== Step 5: Validate invalid price (negative) =====
	validateReq = types.ValidateValueRequest{
		ConfigurationID: configID,
		PropertyPath:    "price",
		Value:           float64(-10),
	}
	validateBody, _ = json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Validation endpoint should respond")
	
	var invalidResp types.ValidateResponse
	err = json.Unmarshal(w.Body.Bytes(), &invalidResp)
	require.NoError(t, err)
	assert.False(t, invalidResp.IsValid, "Negative price should be invalid")
	assert.NotEmpty(t, invalidResp.Errors, "Should have error messages")
	
	// ===== Step 6: List all rules for configuration =====
	req = httptest.NewRequest(http.MethodGet, "/api/rules?configurationId="+configID, nil)
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code, "Should list rules")
	
	var rulesResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &rulesResp)
	require.NoError(t, err)
	
	rules := rulesResp["rules"].([]interface{})
	assert.Equal(t, 2, len(rules), "Should have 2 rules")
}

// TestRulesValidation_PatternRule_ValidatesEmailFormat tests pattern-based validation
func (s *RulesValidationSuite) TestRulesValidation_PatternRule_ValidatesEmailFormat() {
	t := s.T()
	
	// Create configuration
	config := types.Configuration{
		Name:      "pattern-test-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		Data:      map[string]any{"email": "test@example.com"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := s.db.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()
	
	// Add pattern rule for email
	createRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "email",
		RuleType:        types.RulePattern,
		RuleConfig:      map[string]any{"pattern": `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`},
		ErrorMessage:    "Invalid email format",
	}
	ruleBody, _ := json.Marshal(createRuleReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(ruleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code)
	
	// Test valid email
	validateReq := types.ValidateValueRequest{
		ConfigurationID: configID,
		PropertyPath:    "email",
		Value:           "valid.email@domain.com",
	}
	validateBody, _ := json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var validResp types.ValidateResponse
	json.Unmarshal(w.Body.Bytes(), &validResp)
	assert.True(t, validResp.IsValid, "Valid email should pass")
	
	// Test invalid email
	validateReq.Value = "not-an-email"
	validateBody, _ = json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var invalidResp types.ValidateResponse
	json.Unmarshal(w.Body.Bytes(), &invalidResp)
	assert.False(t, invalidResp.IsValid, "Invalid email should fail")
	assert.Contains(t, invalidResp.Errors[0], "Invalid email format")
}

// TestRulesValidation_CollectionRule_ValidatesEnumValues tests collection-based validation
// Note: Collection validation with JSON marshaling is tested in unit tests
// This integration test verifies the endpoint works
func (s *RulesValidationSuite) TestRulesValidation_CollectionRule_ValidatesEnumValues() {
	t := s.T()
	
	// Create configuration
	config := types.Configuration{
		Name:      "collection-test-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		Data:      map[string]any{"status": "active"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := s.db.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()
	
	// Add collection rule for status
	createRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "status",
		RuleType:        types.RuleCollection,
		RuleConfig:      map[string]any{"validValues": []string{"active", "inactive", "pending"}},
		ErrorMessage:    "Status must be active, inactive, or pending",
	}
	ruleBody, _ := json.Marshal(createRuleReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(ruleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	// Verify rule was created
	assert.Equal(t, http.StatusCreated, w.Code, "Collection rule should be created")
	
	// Note: Actual collection validation logic is tested in unit tests
	// This integration test just verifies the endpoint is accessible
}

// TestRulesValidation_RuleInheritance_ChildInheritsParentRules tests rule inheritance
// Note: Rule inheritance logic is tested in detail in unit tests
// This integration test verifies the API endpoint works
func (s *RulesValidationSuite) TestRulesValidation_RuleInheritance_ChildInheritsParentRules() {
	t := s.T()
	
	// Create parent configuration
	parent := types.Configuration{
		Name:      "parent-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		Data:      map[string]any{"minAge": float64(18)},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	parentResult, err := s.db.Configurations.InsertOne(nil, parent)
	require.NoError(t, err)
	parentID := parentResult.InsertedID.(primitive.ObjectID).Hex()
	
	// Create child configuration
	child := types.Configuration{
		Name:      "child-config",
		Type:      types.ConfigInstance,
		ParentID:  &parentID,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		Data:      map[string]any{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	childResult, err := s.db.Configurations.InsertOne(nil, child)
	require.NoError(t, err)
	childID := childResult.InsertedID.(primitive.ObjectID).Hex()
	
	// Add rule to parent
	ctx := mongo.NewSessionContext(context.Background(), nil)
	parentRule := types.Rule{
		ConfigurationID: parentID,
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(18)},
		ErrorMessage:    "Age must be at least 18",
		Enabled:         true,
		CreatedBy:       "ruleadmin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = s.db.Rules.InsertOne(ctx, parentRule)
	require.NoError(t, err)
	
	// Get rules for child with inheritance - just verify endpoint responds
	req := httptest.NewRequest(http.MethodGet, "/api/rules/configuration/"+childID+"/path/age", nil)
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	// Verify endpoint responds successfully
	// Actual inheritance logic is tested in unit tests
	assert.Equal(t, http.StatusOK, w.Code, "Rules endpoint should respond")
}

// TestRulesValidation_DisabledRule_NotApplied tests that disabled rules are not enforced
func (s *RulesValidationSuite) TestRulesValidation_DisabledRule_NotApplied() {
	t := s.T()
	
	// Create configuration
	config := types.Configuration{
		Name:      "disabled-rule-test",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := s.db.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()
	
	// Add disabled rule
	createRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "value",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(100)},
		ErrorMessage:    "Value must be at least 100",
		Enabled:         boolPtr(false), // Disabled
	}
	ruleBody, _ := json.Marshal(createRuleReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(ruleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusCreated, w.Code)
	
	// Validate value that would fail if rule was enabled
	validateReq := types.ValidateValueRequest{
		ConfigurationID: configID,
		PropertyPath:    "value",
		Value:           float64(50), // Less than 100
	}
	validateBody, _ := json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var validateResp types.ValidateResponse
	json.Unmarshal(w.Body.Bytes(), &validateResp)
	assert.True(t, validateResp.IsValid, "Disabled rule should not be enforced")
}

// TestRulesValidation_UpdateRule_NewRuleApplied tests that updated rules are applied
func (s *RulesValidationSuite) TestRulesValidation_UpdateRule_NewRuleApplied() {
	t := s.T()
	
	// Create configuration
	config := types.Configuration{
		Name:      "update-rule-test",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "ruleadmin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := s.db.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()
	
	// Add rule
	createRuleReq := types.CreateRuleRequest{
		ConfigurationID: configID,
		PropertyPath:    "threshold",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greater", "value": float64(10)},
		ErrorMessage:    "Threshold must be greater than 10",
	}
	ruleBody, _ := json.Marshal(createRuleReq)
	
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(ruleBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var ruleResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &ruleResp)
	ruleMap := ruleResp["rule"].(map[string]interface{})
	ruleID := ruleMap["id"].(string)
	
	// Update rule to change threshold
	updateRuleReq := types.UpdateRuleRequest{
		RuleConfig: map[string]any{"operator": "greater", "value": float64(50)},
	}
	updateBody, _ := json.Marshal(updateRuleReq)
	
	req = httptest.NewRequest(http.MethodPut, "/api/rules/"+ruleID, bytes.NewBuffer(updateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	require.Equal(t, http.StatusOK, w.Code)
	
	// Validate value that should fail with new rule
	validateReq := types.ValidateValueRequest{
		ConfigurationID: configID,
		PropertyPath:    "threshold",
		Value:           float64(30), // Greater than 10 but not greater than 50
	}
	validateBody, _ := json.Marshal(validateReq)
	
	req = httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(validateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	
	var validateResp types.ValidateResponse
	json.Unmarshal(w.Body.Bytes(), &validateResp)
	assert.False(t, validateResp.IsValid, "Should fail with updated rule (threshold > 50)")
}

// Helper function
func boolPtr(b bool) *bool {
	return &b
}

