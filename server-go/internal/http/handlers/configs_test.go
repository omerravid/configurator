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

	"your.module/config-manager/internal/http/middleware"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/testutil"
)

func TestConfigsHandler_List(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	tests := []struct {
		name           string
		queryParams    string
		seedConfigs    []types.Configuration
		expectedCount  int
		expectedStatus int
	}{
		{
			name:        "list all configs",
			queryParams: "",
			seedConfigs: []types.Configuration{
				{Name: "config1", Type: types.ConfigProduct, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
				{Name: "config2", Type: types.ConfigInstance, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
			},
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
		{
			name:        "filter by type",
			queryParams: "?type=PRODUCT",
			seedConfigs: []types.Configuration{
				{Name: "product1", Type: types.ConfigProduct, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
				{Name: "instance1", Type: types.ConfigInstance, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
			},
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:        "exclude archived by default",
			queryParams: "",
			seedConfigs: []types.Configuration{
				{Name: "active", Type: types.ConfigProduct, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
				{Name: "archived", Type: types.ConfigProduct, Archived: true, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
			},
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:        "include archived when requested",
			queryParams: "?includeArchived=true",
			seedConfigs: []types.Configuration{
				{Name: "active", Type: types.ConfigProduct, Archived: false, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
				{Name: "archived", Type: types.ConfigProduct, Archived: true, Status: types.StatusCommitted, CreatedBy: "user1", CreatedAt: time.Now(), UpdatedAt: time.Now()},
			},
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			dbClient, cleanup := testutil.SetupTestDB(t)
			defer cleanup()

			// Seed data
			for _, cfg := range tt.seedConfigs {
				_, err := dbClient.Configurations.InsertOne(nil, cfg)
				require.NoError(t, err)
			}

			handler := NewConfigsHandler(dbClient, nil, log)
			router := gin.New()
			authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
			api := router.Group("/api", authMiddleware)
			
			checkPermissions := middleware.CheckConfigPermissions(dbClient)
			requireAdmin := middleware.RequireAdmin()
			handler.Register(api, checkPermissions, requireAdmin)

			// Act
			req := httptest.NewRequest(http.MethodGet, "/api/configs"+tt.queryParams, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)
			
			configs, ok := response["configs"].([]interface{})
			require.True(t, ok)
			assert.Equal(t, tt.expectedCount, len(configs))
		})
	}
}

func TestConfigsHandler_Create(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	tests := []struct {
		name           string
		userRole       types.Role
		request        types.CreateConfigRequest
		expectedStatus int
		expectError    bool
	}{
		{
			name:     "admin can create PRODUCT config",
			userRole: types.RoleAdmin,
			request: types.CreateConfigRequest{
				Name:        "test-product",
				Type:        types.ConfigProduct,
				Description: "Test product",
				Data:        map[string]any{"key": "value"},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name:     "user cannot create PRODUCT config",
			userRole: types.RoleUser,
			request: types.CreateConfigRequest{
				Name:        "test-product",
				Type:        types.ConfigProduct,
				Description: "Test product",
			},
			expectedStatus: http.StatusForbidden,
			expectError:    true,
		},
		{
			name:     "user can create USER config",
			userRole: types.RoleUser,
			request: types.CreateConfigRequest{
				Name:        "test-user-config",
				Type:        types.ConfigUser,
				Description: "Test user config",
				Data:        map[string]any{"setting": "value"},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name:     "duplicate name fails",
			userRole: types.RoleAdmin,
			request: types.CreateConfigRequest{
				Name: "duplicate",
				Type: types.ConfigProduct,
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:     "admin can create INSTANCE config",
			userRole: types.RoleAdmin,
			request: types.CreateConfigRequest{
				Name: "test-instance",
				Type: types.ConfigInstance,
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name:     "admin can create COMPONENT config",
			userRole: types.RoleAdmin,
			request: types.CreateConfigRequest{
				Name: "test-component",
				Type: types.ConfigComponent,
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

			// For duplicate test, insert existing config
			if tt.name == "duplicate name fails" {
				existing := types.Configuration{
					Name:      "duplicate",
					Type:      types.ConfigProduct,
					Status:    types.StatusCommitted,
					Archived:  false,
					CreatedBy: "admin",
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				_, err := dbClient.Configurations.InsertOne(nil, existing)
				require.NoError(t, err)
			}

			handler := NewConfigsHandler(dbClient, nil, log)
			router := gin.New()
			authMiddleware := mockAuthMiddleware("testuser", tt.userRole, "user123")
			api := router.Group("/api", authMiddleware)
			
			checkPermissions := middleware.CheckConfigPermissions(dbClient)
			requireAdmin := middleware.RequireAdmin()
			handler.Register(api, checkPermissions, requireAdmin)

			// Act
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest(http.MethodPost, "/api/configs", bytes.NewBuffer(body))
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
				assert.Contains(t, response, "config")
				config := response["config"].(map[string]interface{})
				assert.Equal(t, tt.request.Name, config["name"])
				assert.Equal(t, string(tt.request.Type), config["type"])
			}
		})
	}
}

func TestConfigsHandler_GetResolved(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a product config
	product := types.Configuration{
		Name:      "test-product",
		Type:      types.ConfigProduct,
		Data:      map[string]any{"color": "blue", "size": float64(10)},
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)
	productID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("get resolved without provenance", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+productID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response types.ResolveResult
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "blue", response.Resolved["color"])
	})

	t.Run("get resolved with provenance", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+productID+"?provenance=true", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response types.ResolveResult
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// With provenance, values are wrapped
		assert.NotNil(t, response.Resolved["color"])
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/invalid-id", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("non-existent id returns not found", func(t *testing.T) {
		// Act
		nonExistentID := primitive.NewObjectID().Hex()
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+nonExistentID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestConfigsHandler_GetResolvedData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	product := types.Configuration{
		Name:      "test-product",
		Type:      types.ConfigProduct,
		Data:      map[string]any{"color": "red", "weight": float64(50)},
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)
	productID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("get data with metadata (default)", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+productID+"/data", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "data")
		assert.Contains(t, response, "metadata")
	})

	t.Run("get minimal data without metadata", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+productID+"/data?minimal=true", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Minimal response is just the data
		assert.NotContains(t, response, "metadata")
	})
}

func TestConfigsHandler_Update(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	product := types.Configuration{
		Name:        "test-product",
		Type:        types.ConfigProduct,
		Data:        map[string]any{"color": "blue"},
		Description: "Original description",
		Status:      types.StatusCommitted,
		Archived:    false,
		CreatedBy:   "admin",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)
	productID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("admin", types.RoleAdmin, "admin123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("update data merges with existing", func(t *testing.T) {
		// Act
		newDesc := "Updated description"
		updateReq := types.UpdateConfigRequest{
			Data:        map[string]any{"size": float64(20)},
			Description: &newDesc,
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/configs/"+productID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		config := response["config"].(map[string]interface{})
		data := config["data"].(map[string]interface{})
		assert.Equal(t, "blue", data["color"]) // Original data preserved
		assert.Equal(t, float64(20), data["size"]) // New data added
		assert.Equal(t, "Updated description", config["description"])
	})

	t.Run("update non-existent config returns not found", func(t *testing.T) {
		// Act
		nonExistentID := primitive.NewObjectID().Hex()
		updateReq := types.UpdateConfigRequest{
			Data: map[string]any{"key": "value"},
		}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/configs/"+nonExistentID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("empty update returns bad request", func(t *testing.T) {
		// Act
		updateReq := types.UpdateConfigRequest{}
		body, _ := json.Marshal(updateReq)
		req := httptest.NewRequest(http.MethodPut, "/api/configs/"+productID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestConfigsHandler_Rename(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	product := types.Configuration{
		Name:      "old-name",
		Type:      types.ConfigProduct,
		Data:      map[string]any{},
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)
	productID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("admin", types.RoleAdmin, "admin123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("successful rename", func(t *testing.T) {
		// Act
		renameReq := types.RenameConfigRequest{Name: "new-name"}
		body, _ := json.Marshal(renameReq)
		req := httptest.NewRequest(http.MethodPut, "/api/configs/"+productID+"/rename", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		config := response["config"].(map[string]interface{})
		assert.Equal(t, "new-name", config["name"])
	})

	t.Run("rename to duplicate name fails", func(t *testing.T) {
		// Create another config with target name
		duplicate := types.Configuration{
			Name:      "duplicate-name",
			Type:      types.ConfigProduct,
			Status:    types.StatusCommitted,
			Archived:  false,
			CreatedBy: "admin",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_, err := dbClient.Configurations.InsertOne(nil, duplicate)
		require.NoError(t, err)

		// Act
		renameReq := types.RenameConfigRequest{Name: "duplicate-name"}
		body, _ := json.Marshal(renameReq)
		req := httptest.NewRequest(http.MethodPut, "/api/configs/"+productID+"/rename", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestConfigsHandler_Children(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create parent
	parent := types.Configuration{
		Name:      "parent",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, parent)
	require.NoError(t, err)
	parentID := result.InsertedID.(primitive.ObjectID).Hex()

	// Create children
	child1 := types.Configuration{
		Name:      "child1",
		Type:      types.ConfigInstance,
		ParentID:  &parentID,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = dbClient.Configurations.InsertOne(nil, child1)
	require.NoError(t, err)

	child2 := types.Configuration{
		Name:      "child2-archived",
		Type:      types.ConfigInstance,
		ParentID:  &parentID,
		Status:    types.StatusCommitted,
		Archived:  true,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = dbClient.Configurations.InsertOne(nil, child2)
	require.NoError(t, err)

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("get children excludes archived by default", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+parentID+"/children", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		children := response["children"].([]interface{})
		assert.Equal(t, 1, len(children))
		assert.Equal(t, float64(1), response["count"])
	})

	t.Run("get children includes archived when requested", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/"+parentID+"/children?includeArchived=true", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		children := response["children"].([]interface{})
		assert.Equal(t, 2, len(children))
		assert.Equal(t, float64(2), response["count"])
	})
}

func TestConfigsHandler_ByNameData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	product := types.Configuration{
		Name:      "test-config",
		Type:      types.ConfigProduct,
		Data:      map[string]any{"color": "green", "nested": map[string]any{"value": float64(100)}},
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("get all data by name", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/by-name/test-config/data", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "data")
	})

	t.Run("get minimal data by name", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/by-name/test-config/data?minimal=true", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Minimal returns unwrapped data directly
		assert.Contains(t, response, "color")
	})

	t.Run("get specific path", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/by-name/test-config/data?path=color&minimal=true", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var result string
		err := json.Unmarshal(w.Body.Bytes(), &result)
		require.NoError(t, err)
		assert.Equal(t, "green", result)
	})

	t.Run("non-existent config returns not found", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/by-name/nonexistent/data", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestConfigsHandler_Commit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a DRAFT user config
	userConfig := types.Configuration{
		Name:      "user-draft",
		Type:      types.ConfigUser,
		Status:    types.StatusDraft,
		Archived:  false,
		CreatedBy: "user1",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, userConfig)
	require.NoError(t, err)
	userConfigID := result.InsertedID.(primitive.ObjectID).Hex()

	// Create a PRODUCT config (cannot be committed)
	productConfig := types.Configuration{
		Name:      "product",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err = dbClient.Configurations.InsertOne(nil, productConfig)
	require.NoError(t, err)
	productConfigID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("user1", types.RoleUser, "user1")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("commit draft user config", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodPost, "/api/configs/"+userConfigID+"/commit", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		config := response["config"].(map[string]interface{})
		assert.Equal(t, string(types.StatusCommitted), config["status"])
	})

	t.Run("cannot commit product config", func(t *testing.T) {
		// Need admin middleware for this test
		router2 := gin.New()
		adminMiddleware := mockAuthMiddleware("admin", types.RoleAdmin, "admin123")
		api2 := router2.Group("/api", adminMiddleware)
		handler.Register(api2, checkPermissions, requireAdmin)

		// Act
		req := httptest.NewRequest(http.MethodPost, "/api/configs/"+productConfigID+"/commit", nil)
		w := httptest.NewRecorder()
		router2.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestConfigsHandler_ArchiveRestore(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	product := types.Configuration{
		Name:      "test-product",
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, product)
	require.NoError(t, err)
	productID := result.InsertedID.(primitive.ObjectID).Hex()

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("admin", types.RoleAdmin, "admin123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("archive config", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodPost, "/api/configs/"+productID+"/archive", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		config := response["config"].(map[string]interface{})
		assert.Equal(t, true, config["archived"])
	})

	t.Run("restore config", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodPost, "/api/configs/"+productID+"/restore", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		config := response["config"].(map[string]interface{})
		assert.Equal(t, false, config["archived"])
	})
}

func TestConfigsHandler_Components(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New(logger.InfoLevel)

	// Arrange
	dbClient, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	// Create a component
	component := types.Configuration{
		Name:      "test-component",
		Type:      types.ConfigComponent,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := dbClient.Configurations.InsertOne(nil, component)
	require.NoError(t, err)
	componentID := result.InsertedID.(primitive.ObjectID).Hex()

	// Create version for the component
	version := types.Configuration{
		Name:      "v1.0",
		Type:      types.ConfigVersion,
		ParentID:  &componentID,
		Status:    types.StatusCommitted,
		Archived:  false,
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = dbClient.Configurations.InsertOne(nil, version)
	require.NoError(t, err)

	handler := NewConfigsHandler(dbClient, nil, log)
	router := gin.New()
	authMiddleware := mockAuthMiddleware("testuser", types.RoleUser, "user123")
	api := router.Group("/api", authMiddleware)
	
	checkPermissions := middleware.CheckConfigPermissions(dbClient)
	requireAdmin := middleware.RequireAdmin()
	handler.Register(api, checkPermissions, requireAdmin)

	t.Run("list components with versions", func(t *testing.T) {
		// Act
		req := httptest.NewRequest(http.MethodGet, "/api/configs/components", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		
		components := response["components"].([]interface{})
		assert.Greater(t, len(components), 0)
		
		// First component should have versions
		comp := components[0].(map[string]interface{})
		versions := comp["versions"].([]interface{})
		assert.Greater(t, len(versions), 0) // Should have at least root version
	})
}

// mockAuthMiddleware creates a mock authentication middleware for testing
func mockAuthMiddleware(username string, role types.Role, userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user", map[string]any{
			"username": username,
			"role":     string(role),
			"userId":   userID,
		})
		c.Next()
	}
}

