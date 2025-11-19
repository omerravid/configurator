package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/configs"
	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/fixtures"
	"your.module/config-manager/tests/testutil"
)

// Example of integration test using testify suite pattern
// This tests the complete lifecycle of configurations with real database

type ConfigLifecycleSuite struct {
	suite.Suite
	db      *testutil.TestDB
	service *configs.Service
	ctx     mongo.SessionContext
}

func (s *ConfigLifecycleSuite) SetupTest() {
	// This runs before each test
	s.db, _ = testutil.SetupTestDB(s.T())
	s.service = configs.New(s.db.Configurations)
	s.ctx = mongo.NewSessionContext(context.Background(), nil)
}

func (s *ConfigLifecycleSuite) TearDownTest() {
	// This runs after each test
	if s.db != nil {
		s.db.Cleanup()
	}
}

func TestConfigLifecycleSuite(t *testing.T) {
	suite.Run(t, new(ConfigLifecycleSuite))
}

func (s *ConfigLifecycleSuite) TestCompleteLifecycle_CreateUpdateCommitArchiveRestore() {
	t := s.T()

	// ===== ARRANGE =====
	username := "testuser"

	// Create a product configuration
	product := fixtures.ProductConfig("TestProduct")
	_, err := s.db.Configurations.InsertOne(s.ctx, product)
	require.NoError(t, err)

	// Create an instance that inherits from product
	instance := fixtures.InstanceConfig("TestInstance", product.ID)
	_, err = s.db.Configurations.InsertOne(s.ctx, instance)
	require.NoError(t, err)

	// ===== ACT & ASSERT: Create User Config =====
	userConfig := fixtures.UserConfig("TestUserConfig", instance.ID, username)
	_, err = s.db.Configurations.InsertOne(s.ctx, userConfig)
	require.NoError(t, err)

	// Verify it's created with DRAFT status
	var created types.Configuration
	err = s.db.Configurations.FindOne(s.ctx, bson.M{"_id": userConfig.ID}).Decode(&created)
	require.NoError(t, err)
	assert.Equal(t, types.StatusDraft, created.Status)

	// ===== ACT & ASSERT: Update Config =====
	updateData := map[string]interface{}{
		"color": "green",
		"customField": "customValue",
	}
	_, err = s.db.Configurations.UpdateOne(
		s.ctx,
		bson.M{"_id": userConfig.ID},
		bson.M{"$set": bson.M{"data": updateData}},
	)
	require.NoError(t, err)

	var updated types.Configuration
	err = s.db.Configurations.FindOne(s.ctx, bson.M{"_id": userConfig.ID}).Decode(&updated)
	require.NoError(t, err)
	assert.Equal(t, "green", updated.Data["color"])
	assert.Equal(t, "customValue", updated.Data["customField"])

	// ===== ACT & ASSERT: Commit Config =====
	_, err = s.db.Configurations.UpdateOne(
		s.ctx,
		bson.M{"_id": userConfig.ID},
		bson.M{"$set": bson.M{"status": types.StatusCommitted}},
	)
	require.NoError(t, err)

	var committed types.Configuration
	err = s.db.Configurations.FindOne(s.ctx, bson.M{"_id": userConfig.ID}).Decode(&committed)
	require.NoError(t, err)
	assert.Equal(t, types.StatusCommitted, committed.Status)

	// ===== ACT & ASSERT: Archive Config =====
	_, err = s.db.Configurations.UpdateOne(
		s.ctx,
		bson.M{"_id": userConfig.ID},
		bson.M{"$set": bson.M{"archived": true, "archived_at": time.Now()}},
	)
	require.NoError(t, err)

	var archived types.Configuration
	err = s.db.Configurations.FindOne(s.ctx, bson.M{"_id": userConfig.ID}).Decode(&archived)
	require.NoError(t, err)
	assert.True(t, archived.Archived)
	assert.NotZero(t, archived.ArchivedAt)

	// ===== ACT & ASSERT: Restore Config =====
	_, err = s.db.Configurations.UpdateOne(
		s.ctx,
		bson.M{"_id": userConfig.ID},
		bson.M{
			"$set":   bson.M{"archived": false},
			"$unset": bson.M{"archived_at": ""},
		},
	)
	require.NoError(t, err)

	var restored types.Configuration
	err = s.db.Configurations.FindOne(s.ctx, bson.M{"_id": userConfig.ID}).Decode(&restored)
	require.NoError(t, err)
	assert.False(t, restored.Archived)
}

func (s *ConfigLifecycleSuite) TestInheritanceChain_MultiLevel_MergesCorrectly() {
	t := s.T()

	// ===== ARRANGE =====
	// Create inheritance chain: Product -> Instance -> User
	product := types.Configuration{
		ID:     "product-1",
		Name:   "Product",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"price":  100,
			"weight": 50,
			"color":  "white",
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := s.db.Configurations.InsertOne(s.ctx, product)
	require.NoError(t, err)

	instanceParent := product.ID
	instance := types.Configuration{
		ID:       "instance-1",
		Name:     "Instance",
		Type:     types.ConfigInstance,
		ParentID: &instanceParent,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 120, // Override
			"color": "red", // Override
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = s.db.Configurations.InsertOne(s.ctx, instance)
	require.NoError(t, err)

	userParent := instance.ID
	user := types.Configuration{
		ID:       "user-1",
		Name:     "User",
		Type:     types.ConfigUser,
		ParentID: &userParent,
		Status:   types.StatusDraft,
		Data: map[string]interface{}{
			"color": "blue", // Override again
		},
		CreatedBy: "testuser",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = s.db.Configurations.InsertOne(s.ctx, user)
	require.NoError(t, err)

	// ===== ACT =====
	result, err := s.service.Resolve(s.ctx, user, false)

	// ===== ASSERT =====
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Verify merged data
	assert.Equal(t, float64(120), result.Resolved["price"], "Price should be from Instance")
	assert.Equal(t, float64(50), result.Resolved["weight"], "Weight should be from Product")
	assert.Equal(t, "blue", result.Resolved["color"], "Color should be from User (final override)")

	// Verify metadata
	assert.Equal(t, user.ID, result.Metadata.ConfigID)
	assert.Equal(t, user.Name, result.Metadata.ConfigName)
	assert.Equal(t, 3, result.Metadata.ChainLength, "Should have 3 configs in chain")
}

func (s *ConfigLifecycleSuite) TestComponentReferenceExpansion_ValidReference_ExpandsCorrectly() {
	t := s.T()

	// ===== ARRANGE =====
	// Create a component configuration
	component := types.Configuration{
		ID:     "component-battery",
		Name:   "Battery",
		Type:   types.ConfigComponent,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"capacity": 5000,
			"voltage":  12,
			"chemistry": "lithium",
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := s.db.Configurations.InsertOne(s.ctx, component)
	require.NoError(t, err)

	// Create a version of the component
	versionParent := component.ID
	version := types.Configuration{
		ID:       "version-battery-v1",
		Name:     "Battery-v1",
		Type:     types.ConfigVersion,
		ParentID: &versionParent,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"capacity": 5500, // Enhanced capacity
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = s.db.Configurations.InsertOne(s.ctx, version)
	require.NoError(t, err)

	// Create a product that references the component version
	product := types.Configuration{
		ID:     "product-with-battery",
		Name:   "ElectricCar",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 50000,
			"Battery": map[string]interface{}{
				"componentId":   component.ID,
				"versionId":     version.ID,
				"componentName": "Battery",
				"versionName":   "v1.0",
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = s.db.Configurations.InsertOne(s.ctx, product)
	require.NoError(t, err)

	// ===== ACT =====
	result, err := s.service.Resolve(s.ctx, product, false)

	// ===== ASSERT =====
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Verify component was expanded
	battery, ok := result.Resolved["Battery"].(map[string]interface{})
	require.True(t, ok, "Battery should be a map")

	// Should contain reference metadata
	assert.Equal(t, component.ID, battery["componentId"])
	assert.Equal(t, version.ID, battery["versionId"])

	// Should contain resolved component data
	assert.Equal(t, float64(5500), battery["capacity"], "Should have version's capacity")
	assert.Equal(t, float64(12), battery["voltage"], "Should have component's voltage")
	assert.Equal(t, "lithium", battery["chemistry"], "Should have component's chemistry")
}

func (s *ConfigLifecycleSuite) TestResolveWithProvenance_TracksSourceCorrectly() {
	t := s.T()

	// ===== ARRANGE =====
	product := types.Configuration{
		ID:     "product-1",
		Name:   "Product",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 100,
			"weight": 50,
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := s.db.Configurations.InsertOne(s.ctx, product)
	require.NoError(t, err)

	instanceParent := product.ID
	instance := types.Configuration{
		ID:       "instance-1",
		Name:     "Instance",
		Type:     types.ConfigInstance,
		ParentID: &instanceParent,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 120, // Override
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = s.db.Configurations.InsertOne(s.ctx, instance)
	require.NoError(t, err)

	// ===== ACT =====
	result, err := s.service.Resolve(s.ctx, instance, true) // includeProvenance = true

	// ===== ASSERT =====
	require.NoError(t, err)
	assert.NotNil(t, result)

	// When provenance is enabled, values should be wrapped with source info
	priceObj, ok := result.Resolved["price"].(map[string]interface{})
	if ok {
		assert.Equal(t, float64(120), priceObj["value"])
		assert.Contains(t, priceObj, "source")
	}

	weightObj, ok := result.Resolved["weight"].(map[string]interface{})
	if ok {
		assert.Equal(t, float64(50), weightObj["value"])
		assert.Contains(t, weightObj, "source")
	}
}

func (s *ConfigLifecycleSuite) TestPathTraversal_ComplexPaths_WorksCorrectly() {
	t := s.T()

	// ===== ARRANGE =====
	config := types.Configuration{
		ID:     "config-1",
		Name:   "TestConfig",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"system": map[string]interface{}{
				"logging": map[string]interface{}{
					"level": "debug",
					"format": "json",
				},
				"ports": []interface{}{8080, 8081, 8082},
			},
			"matrix": []interface{}{
				[]interface{}{1, 2, 3},
				[]interface{}{4, 5, 6},
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := s.db.Configurations.InsertOne(s.ctx, config)
	require.NoError(t, err)

	// ===== ACT & ASSERT =====
	result, err := s.service.Resolve(s.ctx, config, false)
	require.NoError(t, err)

	// Test dot notation
	system := result.Resolved["system"].(map[string]interface{})
	logging := system["logging"].(map[string]interface{})
	assert.Equal(t, "debug", logging["level"])

	// Test array access
	ports := system["ports"].([]interface{})
	assert.Len(t, ports, 3)
	assert.Equal(t, float64(8080), ports[0])

	// Test nested arrays
	matrix := result.Resolved["matrix"].([]interface{})
	row0 := matrix[0].([]interface{})
	assert.Equal(t, float64(1), row0[0])
}

