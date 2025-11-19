package configs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Tests for provenance tracking utility functions

func TestIsProvenanceWrapper_ValidWrapper_ReturnsTrue(t *testing.T) {
	// Arrange
	wrapper := map[string]interface{}{
		"value": "test-value",
		"source": map[string]interface{}{
			"id":   "config-1",
			"name": "Product",
		},
	}

	// Act
	result := isProvenanceWrapper(wrapper)

	// Assert
	assert.True(t, result)
}

func TestIsProvenanceWrapper_InvalidCases_ReturnsFalse(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
	}{
		{"not a map", "string-value"},
		{"missing value", map[string]interface{}{"source": "data"}},
		{"missing source", map[string]interface{}{"value": "data"}},
		{"extra fields", map[string]interface{}{"value": "x", "source": "y", "extra": "z"}},
		{"empty map", map[string]interface{}{}},
		{"nil", nil},
		{"number", 42},
		{"array", []interface{}{"a", "b"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := isProvenanceWrapper(tt.input)

			// Assert
			assert.False(t, result)
		})
	}
}

func TestExtractActualValue_ProvenanceWrapper_ExtractsValue(t *testing.T) {
	// Arrange
	wrapper := map[string]interface{}{
		"value": "extracted-value",
		"source": map[string]interface{}{
			"id": "config-1",
		},
	}

	// Act
	result := extractActualValue(wrapper)

	// Assert
	assert.Equal(t, "extracted-value", result)
}

func TestExtractActualValue_NestedWrappers_ExtractsDeep(t *testing.T) {
	// Arrange - Double wrapped
	doubleWrapped := map[string]interface{}{
		"value": map[string]interface{}{
			"value": "deep-value",
			"source": map[string]interface{}{
				"id": "inner",
			},
		},
		"source": map[string]interface{}{
			"id": "outer",
		},
	}

	// Act
	result := extractActualValue(doubleWrapped)

	// Assert
	assert.Equal(t, "deep-value", result)
}

func TestExtractActualValue_NonWrapper_ReturnsAsIs(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
	}{
		{"string", "plain-string"},
		{"number", 42},
		{"array", []interface{}{1, 2, 3}},
		{"plain map", map[string]interface{}{"key": "value"}},
		{"nil", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := extractActualValue(tt.input)

			// Assert
			assert.Equal(t, tt.input, result)
		})
	}
}

func TestIsPlainObject_DifferentTypes_ReturnsCorrectly(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  bool
	}{
		{"plain object", map[string]interface{}{"key": "value"}, true},
		{"provenance wrapper", map[string]interface{}{"value": "x", "source": "y"}, false},
		{"string", "text", false},
		{"number", 42, false},
		{"array", []interface{}{1, 2}, false},
		{"nil", nil, false},
		{"empty map", map[string]interface{}{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := isPlainObject(tt.input)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestIsArray_DifferentTypes_ReturnsCorrectly(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  bool
	}{
		{"array", []interface{}{1, 2, 3}, true},
		{"empty array", []interface{}{}, true},
		{"map", map[string]interface{}{}, false},
		{"string", "text", false},
		{"number", 42, false},
		{"nil", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := isArray(tt.input)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestCloneValue_DifferentTypes_CreatesDeepCopy(t *testing.T) {
	// Arrange
	original := map[string]interface{}{
		"name": "test",
		"nested": map[string]interface{}{
			"value": 42,
		},
		"array": []interface{}{1, 2, 3},
	}

	// Act
	cloned := cloneValue(original)

	// Assert
	clonedMap, ok := cloned.(map[string]interface{})
	require.True(t, ok)

	// Verify deep copy by modifying original
	original["name"] = "modified"
	assert.Equal(t, "test", clonedMap["name"], "Clone should not be affected by original modification")

	// Modify nested object
	originalNested := original["nested"].(map[string]interface{})
	originalNested["value"] = 999

	clonedNested := clonedMap["nested"].(map[string]interface{})
	assert.Equal(t, float64(42), clonedNested["value"], "Nested clone should not be affected")
}

func TestCloneValue_Nil_ReturnsNil(t *testing.T) {
	// Act
	result := cloneValue(nil)

	// Assert
	assert.Nil(t, result)
}

func TestExtractOriginalSource_ValidWrapper_ExtractsSource(t *testing.T) {
	// Arrange
	wrapper := map[string]interface{}{
		"value": "test",
		"source": map[string]interface{}{
			"id":        "config-123",
			"name":      "TestConfig",
			"type":      "PRODUCT",
			"createdBy": "admin",
		},
	}

	// Act
	source := extractOriginalSource(wrapper)

	// Assert
	require.NotNil(t, source)
	assert.Equal(t, "config-123", source.ID)
	assert.Equal(t, "TestConfig", source.Name)
	assert.Equal(t, "PRODUCT", source.Type)
	assert.Equal(t, "admin", source.CreatedBy)
}

func TestExtractOriginalSource_NonWrapper_ReturnsNil(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
	}{
		{"plain string", "text"},
		{"plain map", map[string]interface{}{"key": "value"}},
		{"missing source", map[string]interface{}{"value": "test"}},
		{"nil", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			source := extractOriginalSource(tt.input)

			// Assert
			assert.Nil(t, source)
		})
	}
}

func TestAddProvenanceToObject_WithProvenance_WrapsAllFields(t *testing.T) {
	// Arrange
	obj := map[string]interface{}{
		"name":  "Product",
		"price": 100,
		"active": true,
	}
	source := SourceInfo{
		ID:   "config-1",
		Name: "TestConfig",
		Type: "PRODUCT",
	}

	// Act
	result := addProvenanceToObject(obj, source, true)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	// Check name is wrapped
	nameWrapper, ok := resultMap["name"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "Product", nameWrapper["value"])
	assert.NotNil(t, nameWrapper["source"])

	// Check price is wrapped
	priceWrapper, ok := resultMap["price"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(100), priceWrapper["value"])

	// Check bool is wrapped
	activeWrapper, ok := resultMap["active"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, true, activeWrapper["value"])
}

func TestAddProvenanceToObject_WithoutProvenance_ReturnsClone(t *testing.T) {
	// Arrange
	obj := map[string]interface{}{
		"name":  "Product",
		"price": 100,
	}
	source := SourceInfo{ID: "config-1"}

	// Act
	result := addProvenanceToObject(obj, source, false)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	// Should be unwrapped values
	assert.Equal(t, "Product", resultMap["name"])
	assert.Equal(t, float64(100), resultMap["price"])
}

func TestAddProvenanceToObject_NestedObject_WrapsRecursively(t *testing.T) {
	// Arrange
	obj := map[string]interface{}{
		"config": map[string]interface{}{
			"name": "nested",
			"settings": map[string]interface{}{
				"enabled": true,
			},
		},
	}
	source := SourceInfo{ID: "config-1"}

	// Act
	result := addProvenanceToObject(obj, source, true)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	// Navigate to nested config (should be plain object, not wrapped)
	config, ok := resultMap["config"].(map[string]interface{})
	require.True(t, ok)

	// Nested properties should be wrapped
	nameWrapper, ok := config["name"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "nested", nameWrapper["value"])
}

func TestPreserveOriginalProvenance_WithExistingProvenance_KeepsOriginal(t *testing.T) {
	// Arrange
	obj := map[string]interface{}{
		"value": "original-value",
		"source": map[string]interface{}{
			"id":   "original-source",
			"name": "Original",
		},
	}
	fallbackSource := SourceInfo{
		ID:   "fallback-source",
		Name: "Fallback",
	}

	// Act
	result := preserveOriginalProvenance(obj, fallbackSource, true)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	// Should keep original source
	source, ok := resultMap["source"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "original-source", source["id"])
	assert.Equal(t, "original-value", resultMap["value"])
}

func TestPreserveOriginalProvenance_WithoutProvenance_AddsFallback(t *testing.T) {
	// Arrange
	obj := "plain-value"
	fallbackSource := SourceInfo{
		ID:   "fallback-source",
		Name: "Fallback",
	}

	// Act
	result := preserveOriginalProvenance(obj, fallbackSource, true)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, "plain-value", resultMap["value"])
	
	source, ok := resultMap["source"].(SourceInfo)
	require.True(t, ok)
	assert.Equal(t, "fallback-source", source.ID)
}

func TestDeepMergeWithFullProvenance_SimpleOverride_MergesCorrectly(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"price":  100,
		"weight": 50,
		"color":  "white",
	}
	override := map[string]interface{}{
		"price": 120,
		"color": "red",
	}
	baseSource := SourceInfo{ID: "base", Name: "Base"}
	overrideSource := SourceInfo{ID: "override", Name: "Override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	assert.Equal(t, float64(120), result["price"], "Override should win")
	assert.Equal(t, "red", result["color"], "Override should win")
	assert.Equal(t, float64(50), result["weight"], "Base value should be inherited")
}

func TestDeepMergeWithFullProvenance_NestedObjects_MergesDeep(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"config": map[string]interface{}{
			"timeout": 30,
			"retries": 3,
		},
	}
	override := map[string]interface{}{
		"config": map[string]interface{}{
			"timeout": 60,
		},
	}
	baseSource := SourceInfo{ID: "base"}
	overrideSource := SourceInfo{ID: "override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	config, ok := result["config"].(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, float64(60), config["timeout"], "Nested override should win")
	assert.Equal(t, float64(3), config["retries"], "Nested base value should be inherited")
}

func TestDeepMergeWithFullProvenance_WithProvenance_TracksSources(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"price":  100,
		"weight": 50,
	}
	override := map[string]interface{}{
		"price": 120,
	}
	baseSource := SourceInfo{ID: "base", Name: "BaseConfig"}
	overrideSource := SourceInfo{ID: "override", Name: "OverrideConfig"}

	// Act - WITH provenance
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, true)

	// Assert
	// Price should be wrapped with override source
	priceWrapper, ok := result["price"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(120), priceWrapper["value"])
	priceSource, ok := priceWrapper["source"].(SourceInfo)
	require.True(t, ok)
	assert.Equal(t, "override", priceSource.ID)

	// Weight should be wrapped with base source
	weightWrapper, ok := result["weight"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(50), weightWrapper["value"])
	weightSource, ok := weightWrapper["source"].(SourceInfo)
	require.True(t, ok)
	assert.Equal(t, "base", weightSource.ID)
}

func TestDeepMergeWithFullProvenance_ArraysReplaceCompletely_NotMerged(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"items": []interface{}{1, 2, 3},
	}
	override := map[string]interface{}{
		"items": []interface{}{4, 5},
	}
	baseSource := SourceInfo{ID: "base"}
	overrideSource := SourceInfo{ID: "override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	items, ok := result["items"].([]interface{})
	require.True(t, ok)
	
	// Arrays replace, not merge
	require.Len(t, items, 2)
	assert.Equal(t, float64(4), items[0])
	assert.Equal(t, float64(5), items[1])
}

func TestDeepMergeWithFullProvenance_EmptyOverride_KeepsBase(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"price":  100,
		"weight": 50,
	}
	override := map[string]interface{}{}
	baseSource := SourceInfo{ID: "base"}
	overrideSource := SourceInfo{ID: "override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	assert.Equal(t, float64(100), result["price"])
	assert.Equal(t, float64(50), result["weight"])
}

func TestDeepMergeWithFullProvenance_EmptyBase_UsesOverride(t *testing.T) {
	// Arrange
	base := map[string]interface{}{}
	override := map[string]interface{}{
		"price": 120,
		"color": "red",
	}
	baseSource := SourceInfo{ID: "base"}
	overrideSource := SourceInfo{ID: "override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	assert.Equal(t, float64(120), result["price"])
	assert.Equal(t, "red", result["color"])
}

func TestDeepMergeWithFullProvenance_ThreeLevelNesting_MergesCorrectly(t *testing.T) {
	// Arrange
	base := map[string]interface{}{
		"system": map[string]interface{}{
			"logging": map[string]interface{}{
				"level":  "info",
				"format": "json",
			},
		},
	}
	override := map[string]interface{}{
		"system": map[string]interface{}{
			"logging": map[string]interface{}{
				"level": "debug",
			},
		},
	}
	baseSource := SourceInfo{ID: "base"}
	overrideSource := SourceInfo{ID: "override"}

	// Act
	result := deepMergeWithFullProvenance(base, override, baseSource, overrideSource, false)

	// Assert
	system, ok := result["system"].(map[string]interface{})
	require.True(t, ok)
	
	logging, ok := system["logging"].(map[string]interface{})
	require.True(t, ok)
	
	assert.Equal(t, "debug", logging["level"], "Deep override should work")
	assert.Equal(t, "json", logging["format"], "Deep inheritance should work")
}

func TestDeepMergeWithFullProvenance_ComplexRealWorldScenario_WorksCorrectly(t *testing.T) {
	// Arrange - Realistic scenario with Product -> Instance -> User chain
	product := map[string]interface{}{
		"price": 100,
		"dimensions": map[string]interface{}{
			"width":  10,
			"height": 20,
			"depth":  5,
		},
		"features": []interface{}{"feature1", "feature2"},
	}

	instance := map[string]interface{}{
		"price": 120,
		"dimensions": map[string]interface{}{
			"width": 12, // Override one dimension
		},
		"color": "red",
	}

	productSource := SourceInfo{ID: "product", Type: "PRODUCT"}
	instanceSource := SourceInfo{ID: "instance", Type: "INSTANCE"}

	// Act - First merge: product + instance
	result := deepMergeWithFullProvenance(product, instance, productSource, instanceSource, false)

	// Assert
	assert.Equal(t, float64(120), result["price"], "Instance price should override")
	assert.Equal(t, "red", result["color"], "Instance color should be added")

	dimensions, ok := result["dimensions"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(12), dimensions["width"], "Instance width should override")
	assert.Equal(t, float64(20), dimensions["height"], "Product height should be inherited")
	assert.Equal(t, float64(5), dimensions["depth"], "Product depth should be inherited")

	features, ok := result["features"].([]interface{})
	require.True(t, ok)
	assert.Len(t, features, 2, "Product features should be inherited")
}

