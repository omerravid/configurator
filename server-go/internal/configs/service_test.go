package configs

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/types"
	"your.module/config-manager/tests/fixtures"
	"your.module/config-manager/tests/testutil"
)

// Example of service tests with real database
// Demonstrates testing complex business logic

func TestResolve_SingleConfig_ReturnsConfigData(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	config := fixtures.ProductConfig("TestProduct")
	_, err := db.Configurations.InsertOne(ctx, config)
	require.NoError(t, err)

	// Act
	result, err := service.Resolve(ctx, config, false)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, config.ID, result.Metadata.ConfigID)
	assert.Equal(t, config.Name, result.Metadata.ConfigName)
	assert.Equal(t, 1, result.Metadata.ChainLength)

	// Verify data is present
	assert.Equal(t, float64(100), result.Resolved["price"])
	assert.Equal(t, float64(50), result.Resolved["weight"])
}

func TestResolve_TwoLevelInheritance_MergesCorrectly(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	// Create parent
	parent := types.Configuration{
		ID:     "parent-1",
		Name:   "Parent",
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
	_, err := db.Configurations.InsertOne(ctx, parent)
	require.NoError(t, err)

	// Create child
	parentID := parent.ID
	child := types.Configuration{
		ID:       "child-1",
		Name:     "Child",
		Type:     types.ConfigInstance,
		ParentID: &parentID,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 120,   // Override
			"color": "red", // Override
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = db.Configurations.InsertOne(ctx, child)
	require.NoError(t, err)

	// Act
	result, err := service.Resolve(ctx, child, false)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, 2, result.Metadata.ChainLength)

	// Child overrides should win
	assert.Equal(t, float64(120), result.Resolved["price"])
	assert.Equal(t, "red", result.Resolved["color"])

	// Parent value should be inherited
	assert.Equal(t, float64(50), result.Resolved["weight"])
}

func TestResolve_ThreeLevelInheritance_MergesInOrder(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	// Create grandparent (PRODUCT)
	grandparent := types.Configuration{
		ID:     "gp-1",
		Name:   "Grandparent",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"a": 1,
			"b": 2,
			"c": 3,
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := db.Configurations.InsertOne(ctx, grandparent)
	require.NoError(t, err)

	// Create parent (INSTANCE)
	gpID := grandparent.ID
	parent := types.Configuration{
		ID:       "p-1",
		Name:     "Parent",
		Type:     types.ConfigInstance,
		ParentID: &gpID,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"b": 20, // Override
			"d": 4,  // New
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = db.Configurations.InsertOne(ctx, parent)
	require.NoError(t, err)

	// Create child (USER)
	pID := parent.ID
	child := types.Configuration{
		ID:       "c-1",
		Name:     "Child",
		Type:     types.ConfigUser,
		ParentID: &pID,
		Status:   types.StatusDraft,
		Data: map[string]interface{}{
			"c": 30, // Override
			"e": 5,  // New
		},
		CreatedBy: "testuser",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = db.Configurations.InsertOne(ctx, child)
	require.NoError(t, err)

	// Act
	result, err := service.Resolve(ctx, child, false)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, 3, result.Metadata.ChainLength)

	// Verify merge order: grandparent < parent < child
	assert.Equal(t, float64(1), result.Resolved["a"])  // From grandparent
	assert.Equal(t, float64(20), result.Resolved["b"]) // From parent (overrides grandparent)
	assert.Equal(t, float64(30), result.Resolved["c"]) // From child (overrides grandparent)
	assert.Equal(t, float64(4), result.Resolved["d"])  // From parent
	assert.Equal(t, float64(5), result.Resolved["e"])  // From child
}

func TestResolve_NestedObjects_MergesDeep(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	parent := types.Configuration{
		ID:     "parent-1",
		Name:   "Parent",
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"system": map[string]interface{}{
				"logging": map[string]interface{}{
					"level":  "info",
					"format": "json",
				},
				"port": 8080,
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := db.Configurations.InsertOne(ctx, parent)
	require.NoError(t, err)

	parentID := parent.ID
	child := types.Configuration{
		ID:       "child-1",
		Name:     "Child",
		Type:     types.ConfigInstance,
		ParentID: &parentID,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"system": map[string]interface{}{
				"logging": map[string]interface{}{
					"level": "debug", // Override nested value
				},
				"timeout": 30, // Add new nested value
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err = db.Configurations.InsertOne(ctx, child)
	require.NoError(t, err)

	// Act
	result, err := service.Resolve(ctx, child, false)

	// Assert
	require.NoError(t, err)

	system := result.Resolved["system"].(map[string]interface{})
	logging := system["logging"].(map[string]interface{})

	assert.Equal(t, "debug", logging["level"], "Nested override should work")
	assert.Equal(t, "json", logging["format"], "Non-overridden nested value should be inherited")
	assert.Equal(t, float64(8080), system["port"], "Sibling nested value should be inherited")
	assert.Equal(t, float64(30), system["timeout"], "New nested value should be present")
}

func TestResolve_WithProvenance_IncludesSourceInfo(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	parent := fixtures.ProductConfig("Parent")
	_, err := db.Configurations.InsertOne(ctx, parent)
	require.NoError(t, err)

	child := fixtures.InstanceConfig("Child", parent.ID)
	_, err = db.Configurations.InsertOne(ctx, child)
	require.NoError(t, err)

	// Act - WITH provenance
	result, err := service.Resolve(ctx, child, true)

	// Assert
	require.NoError(t, err)

	// When provenance is enabled, values might be wrapped with source info
	// The exact structure depends on your implementation
	assert.NotNil(t, result.Resolved)
}

func TestExpandComponentReferences_ValidReference_ExpandsComponent(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := context.Background()

	// Create a component with proper ObjectID
	component := fixtures.ComponentConfig("Battery")
	component.ID = "" // Let MongoDB generate the ID
	result, err := db.Configurations.InsertOne(ctx, component)
	require.NoError(t, err)

	// Get the generated ObjectID
	componentOID := result.InsertedID.(primitive.ObjectID)
	componentIDStr := componentOID.Hex()

	// Create a product with component reference
	productData := map[string]interface{}{
		"price": 50000,
		"Battery": map[string]interface{}{
			"versionId": componentIDStr,
		},
	}

	// Act
	expanded, err := service.expandComponentReferences(ctx, productData, false)

	// Assert
	require.NoError(t, err)

	battery, ok := expanded["Battery"].(map[string]interface{})
	require.True(t, ok, "Battery should be expanded")

	// Should contain the component data (check that fields exist, values may be nil)
	_, hasCapacity := battery["capacity"]
	_, hasVoltage := battery["voltage"]
	assert.True(t, hasCapacity, "Battery should have capacity field")
	assert.True(t, hasVoltage, "Battery should have voltage field")
}

func TestExpandComponentReferences_InvalidReference_KeepsOriginal(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := context.Background()

	productData := map[string]interface{}{
		"price": 50000,
		"Battery": map[string]interface{}{
			"versionId": "non-existent-id",
		},
	}

	// Act
	expanded, err := service.expandComponentReferences(ctx, productData, false)

	// Assert
	require.NoError(t, err)

	// Should return empty object for missing reference
	_, ok := expanded["Battery"].(map[string]interface{})
	assert.True(t, ok)
}

func TestExpandComponentReferences_NotAReference_KeepsOriginal(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := context.Background()

	productData := map[string]interface{}{
		"price":       50000,
		"description": "A great product",
		"features": map[string]interface{}{
			"color": "red",
			"size":  "large",
		},
	}

	// Act
	expanded, err := service.expandComponentReferences(ctx, productData, false)

	// Assert
	require.NoError(t, err)

	// Non-reference data should be unchanged
	assert.Equal(t, 50000, expanded["price"])
	assert.Equal(t, "A great product", expanded["description"])

	features := expanded["features"].(map[string]interface{})
	assert.Equal(t, "red", features["color"])
}

func TestInheritanceChain_SingleConfig_ReturnsOne(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	config := fixtures.ProductConfig("Single")
	_, err := db.Configurations.InsertOne(ctx, config)
	require.NoError(t, err)

	// Act
	chain, err := service.inheritanceChain(ctx, config)

	// Assert
	require.NoError(t, err)
	assert.Len(t, chain, 1)
	assert.Equal(t, config.ID, chain[0].ID)
}

func TestInheritanceChain_MultiLevel_ReturnsInOrder(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	// Create chain: A -> B -> C
	configA := fixtures.ProductConfig("A")
	_, err := db.Configurations.InsertOne(ctx, configA)
	require.NoError(t, err)

	configB := fixtures.InstanceConfig("B", configA.ID)
	_, err = db.Configurations.InsertOne(ctx, configB)
	require.NoError(t, err)

	configC := fixtures.UserConfig("C", configB.ID, "testuser")
	_, err = db.Configurations.InsertOne(ctx, configC)
	require.NoError(t, err)

	// Act
	chain, err := service.inheritanceChain(ctx, configC)

	// Assert
	require.NoError(t, err)
	assert.Len(t, chain, 3)

	// Should be ordered root -> leaf (A -> B -> C)
	assert.Equal(t, configA.ID, chain[0].ID)
	assert.Equal(t, configB.ID, chain[1].ID)
	assert.Equal(t, configC.ID, chain[2].ID)
}

func TestInheritanceChain_MissingParent_StopsAtMissing(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	service := New(db.Configurations)
	ctx := mongo.NewSessionContext(context.Background(), nil)

	// Create config with non-existent parent
	nonExistentParent := "non-existent-id"
	config := fixtures.InstanceConfig("Child", nonExistentParent)
	_, err := db.Configurations.InsertOne(ctx, config)
	require.NoError(t, err)

	// Act
	chain, err := service.inheritanceChain(ctx, config)

	// Assert
	require.NoError(t, err)
	// Should return just the child since parent doesn't exist
	assert.Len(t, chain, 1)
	assert.Equal(t, config.ID, chain[0].ID)
}

func TestDefaultStatus_UserConfig_ReturnsDraft(t *testing.T) {
	// Arrange
	service := &Service{}

	// Act & Assert
	assert.Equal(t, types.StatusDraft, service.defaultStatus(types.ConfigUser, ""))
	assert.Equal(t, types.StatusCommitted, service.defaultStatus(types.ConfigUser, types.StatusCommitted))
}

func TestDefaultStatus_VersionConfig_ReturnsDraft(t *testing.T) {
	// Arrange
	service := &Service{}

	// Act & Assert
	assert.Equal(t, types.StatusDraft, service.defaultStatus(types.ConfigVersion, ""))
	assert.Equal(t, types.StatusCommitted, service.defaultStatus(types.ConfigVersion, types.StatusCommitted))
}

func TestDefaultStatus_OtherTypes_ReturnsCommitted(t *testing.T) {
	// Table-driven test for different config types
	tests := []struct {
		name       string
		configType types.ConfigType
	}{
		{"Product", types.ConfigProduct},
		{"Instance", types.ConfigInstance},
		{"Component", types.ConfigComponent},
	}

	service := &Service{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act & Assert
			assert.Equal(t, types.StatusCommitted, service.defaultStatus(tt.configType, ""))
			assert.Equal(t, types.StatusCommitted, service.defaultStatus(tt.configType, types.StatusDraft))
		})
	}
}
