package handlers

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
	"go.mongodb.org/mongo-driver/bson/primitive"

	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/testutil"
)

func TestRulesHandler_List(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a configuration
	config := types.Configuration{
		Name:      "test-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()

	// Create rules for this configuration
	rule1 := types.Rule{
		ConfigurationID: configID,
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(0)},
		ErrorMessage:    "Age must be at least 0",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = dbClient.Rules.InsertOne(nil, rule1)
	require.NoError(t, err)

	rule2 := types.Rule{
		ConfigurationID: configID,
		PropertyPath:    "email",
		RuleType:        types.RulePattern,
		RuleConfig:      map[string]any{"pattern": "^[a-z]+@[a-z]+\\.[a-z]+$"},
		ErrorMessage:    "Invalid email format",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = dbClient.Rules.InsertOne(nil, rule2)
	require.NoError(t, err)

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("list rules for configuration", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules?configurationId="+configID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		rules := response["rules"].([]interface{})
		assert.Equal(t, 2, len(rules))
	})

	t.Run("missing configurationId returns bad request", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestRulesHandler_Create(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	tests := []struct {
		name           string
		request        types.CreateRuleRequest
		expectedStatus int
		expectError    bool
	}{
		{
			name: "create numeric rule",
			request: types.CreateRuleRequest{
				ConfigurationID: "config123",
				PropertyPath:    "age",
				RuleType:        types.RuleNumeric,
				RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(0)},
				ErrorMessage:    "Age must be at least 0",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "create pattern rule",
			request: types.CreateRuleRequest{
				ConfigurationID: "config123",
				PropertyPath:    "email",
				RuleType:        types.RulePattern,
				RuleConfig:      map[string]any{"pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"},
				ErrorMessage:    "Invalid email format",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "create collection rule",
			request: types.CreateRuleRequest{
				ConfigurationID: "config123",
				PropertyPath:    "status",
				RuleType:        types.RuleCollection,
				RuleConfig:      map[string]any{"allowedValues": []any{"active", "inactive", "pending"}},
				ErrorMessage:    "Status must be active, inactive, or pending",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "create rule with enabled explicitly false",
			request: types.CreateRuleRequest{
				ConfigurationID: "config123",
				PropertyPath:    "test",
				RuleType:        types.RuleNumeric,
				RuleConfig:      map[string]any{"operator": "equals", "value": float64(100)},
				ErrorMessage:    "Test rule",
				Enabled:         boolPtr(false),
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			dbClient, cleanup := testutil.SetupTestDB(t)
			defer cleanup()

			handler := NewRulesHandler(dbClient, log)
			router := gin.New()
			authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
			api := router.Group("/api", authMiddleware)
			handler.Register(api)

			// Act
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			if tt.expectError {
				assert.Contains(t, response, "error")
			} else {
				assert.Contains(t, response, "rule")
				rule := response["rule"].(map[string]interface{})
				assert.Equal(t, tt.request.PropertyPath, rule["propertyPath"])
				assert.Equal(t, string(tt.request.RuleType), rule["ruleType"])

				// Check enabled flag
				if tt.request.Enabled != nil {
					assert.Equal(t, *tt.request.Enabled, rule["enabled"])
				} else {
					assert.Equal(t, true, rule["enabled"]) // Default is true
				}
			}
		})
	}
}

func TestRulesHandler_Get(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	rule := types.Rule{
		ConfigurationID: "config123",
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greater", "value": float64(0)},
		ErrorMessage:    "Age must be greater than 0",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	result, err := dbClient.Rules.InsertOne(nil, rule)
	require.NoError(t, err)
	ruleID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("get existing rule", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules/"+ruleID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		retrievedRule := response["rule"].(map[string]interface{})
		assert.Equal(t, "age", retrievedRule["propertyPath"])
		assert.Equal(t, string(types.RuleNumeric), retrievedRule["ruleType"])
	})

	t.Run("invalid rule id returns bad request", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules/invalid-id", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("non-existent rule returns not found", func(t *testing.T) {
		// Act
		nonExistentID := primitive.NewObjectID().Hex()
		req := httptest.NewRequest(http.MethodGet, "/api/rules/"+nonExistentID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestRulesHandler_Update(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	rule := types.Rule{
		ConfigurationID: "config123",
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greater", "value": float64(0)},
		ErrorMessage:    "Age must be greater than 0",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	result, err := dbClient.Rules.InsertOne(nil, rule)
	require.NoError(t, err)
	ruleID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("update rule config", func(t *testing.T) {
		// Act
		updateReq := types.UpdateRuleRequest{
			RuleConfig: map[string]any{"operator": "smaller", "value": float64(100)},
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/rules/"+ruleID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		updatedRule := response["rule"].(map[string]interface{})
		ruleConfig := updatedRule["ruleConfig"].(map[string]interface{})
		assert.Equal(t, "smaller", ruleConfig["operator"])
		assert.Equal(t, float64(100), ruleConfig["value"])
	})

	t.Run("update error message", func(t *testing.T) {
		// Act
		newMessage := "Updated error message"
		updateReq := types.UpdateRuleRequest{
			ErrorMessage: &newMessage,
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/rules/"+ruleID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		updatedRule := response["rule"].(map[string]interface{})
		assert.Equal(t, "Updated error message", updatedRule["errorMessage"])
	})

	t.Run("disable rule", func(t *testing.T) {
		// Act
		enabled := false
		updateReq := types.UpdateRuleRequest{
			Enabled: &enabled,
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/rules/"+ruleID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		updatedRule := response["rule"].(map[string]interface{})
		assert.Equal(t, false, updatedRule["enabled"])
	})

	t.Run("empty update returns bad request", func(t *testing.T) {
		// Act
		updateReq := types.UpdateRuleRequest{}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/rules/"+ruleID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("update non-existent rule returns not found", func(t *testing.T) {
		// Act
		nonExistentID := primitive.NewObjectID().Hex()
		newMessage := "test"
		updateReq := types.UpdateRuleRequest{
			ErrorMessage: &newMessage,
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/rules/"+nonExistentID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestRulesHandler_Delete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	rule := types.Rule{
		ConfigurationID: "config123",
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greater", "value": float64(0)},
		ErrorMessage:    "Age must be greater than 0",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	result, err := dbClient.Rules.InsertOne(nil, rule)
	require.NoError(t, err)
	ruleID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("delete existing rule", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodDelete, "/api/rules/"+ruleID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "message")
	})

	t.Run("delete non-existent rule returns not found", func(t *testing.T) {
		// Act
		nonExistentID := primitive.NewObjectID().Hex()
		req := httptest.NewRequest(http.MethodDelete, "/api/rules/"+nonExistentID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("invalid rule id returns bad request", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodDelete, "/api/rules/invalid-id", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestRulesHandler_Validate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a configuration
	config := types.Configuration{
		Name:      "test-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, config)
	require.NoError(t, err)
	configID := result.InsertedID.(primitive.ObjectID).Hex()

	// Create a numeric rule (using operator/value format that the service expects)
	rule := types.Rule{
		ConfigurationID: configID,
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(0)},
		ErrorMessage:    "Age must be at least 0",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = dbClient.Rules.InsertOne(nil, rule)
	require.NoError(t, err)

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("validate valid value", func(t *testing.T) {
		// Act
		validateReq := types.ValidateValueRequest{
			ConfigurationID: configID,
			PropertyPath:    "age",
			Value:           float64(50),
		}
		body, _ := json.Marshal(validateReq)
		req := httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response types.ValidateResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.True(t, response.IsValid)
		assert.Empty(t, response.Errors)
	})

	t.Run("validate invalid value", func(t *testing.T) {
		// Act
		validateReq := types.ValidateValueRequest{
			ConfigurationID: configID,
			PropertyPath:    "age",
			Value:           float64(-10), // Less than 0
		}
		body, _ := json.Marshal(validateReq)
		req := httptest.NewRequest(http.MethodPost, "/api/rules/validate", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response types.ValidateResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.False(t, response.IsValid)
		assert.NotEmpty(t, response.Errors)
	})
}

func TestRulesHandler_ByPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a parent and child configuration
	parent := types.Configuration{
		Name:      "parent-config",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	parentResult, err := dbClient.Configurations.InsertOne(nil, parent)
	require.NoError(t, err)
	parentID := parentResult.InsertedID.(primitive.ObjectID).Hex()

	child := types.Configuration{
		Name:      "child-config",
		Type:      types.ConfigInstance,
		ParentID:  &parentID,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	childResult, err := dbClient.Configurations.InsertOne(nil, child)
	require.NoError(t, err)
	childID := childResult.InsertedID.(primitive.ObjectID).Hex()

	// Create rule for parent
	parentRule := types.Rule{
		ConfigurationID: parentID,
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(0)},
		ErrorMessage:    "Parent rule",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = dbClient.Rules.InsertOne(nil, parentRule)
	require.NoError(t, err)

	// Create rule for child
	childRule := types.Rule{
		ConfigurationID: childID,
		PropertyPath:    "age",
		RuleType:        types.RuleNumeric,
		RuleConfig:      map[string]any{"operator": "greaterEquals", "value": float64(18)},
		ErrorMessage:    "Child rule",
		Enabled:         true,
		CreatedBy:       "admin",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	_, err = dbClient.Rules.InsertOne(nil, childRule)
	require.NoError(t, err)

	handler := NewRulesHandler(dbClient, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	handler.Register(api)

	t.Run("get rules by path without inheritance", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules/configuration/"+childID+"/path/age?includeInherited=false", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		rules := response["rules"].([]interface{})
		assert.Equal(t, 1, len(rules)) // Only child rule
	})

	t.Run("get rules by path with inheritance", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/rules/configuration/"+childID+"/path/age", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		rules := response["rules"].([]interface{})
		assert.GreaterOrEqual(t, len(rules), 1) // At least child rule, possibly parent too
	})
}

// boolPtr is a helper to get a pointer to a bool value
func boolPtr(b bool) *bool {
	return &b
}
