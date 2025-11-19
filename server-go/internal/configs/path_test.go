package configs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Tests for path traversal utility functions following AAA pattern and table-driven approach

func TestGetValueAtPath_SimpleDotNotation_ReturnsValue(t *testing.T) {
	// Arrange
	data := map[string]interface{}{
		"name": "test",
		"age":  30,
		"nested": map[string]interface{}{
			"city":    "Seattle",
			"country": "USA",
		},
	}

	tests := []struct {
		name     string
		path     string
		want     interface{}
		wantErr  bool
	}{
		{"top level string", "name", "test", false},
		{"top level number", "age", 30, false},
		{"nested property", "nested.city", "Seattle", false},
		{"deeply nested", "nested.country", "USA", false},
		{"empty path", "", data, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestGetValueAtPath_ArrayNotation_ReturnsValue(t *testing.T) {
	// Arrange
	data := map[string]interface{}{
		"items": []interface{}{"first", "second", "third"},
		"users": []interface{}{
			map[string]interface{}{"name": "Alice", "age": 25},
			map[string]interface{}{"name": "Bob", "age": 30},
		},
	}

	tests := []struct {
		name    string
		path    string
		want    interface{}
		wantErr bool
	}{
		{"array index 0", "items[0]", "first", false},
		{"array index 1", "items[1]", "second", false},
		{"array index 2", "items[2]", "third", false},
		{"array with dot notation", "users[0].name", "Alice", false},
		{"array with nested property", "users[1].age", 30, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestGetValueAtPath_NestedArrays_ReturnsValue(t *testing.T) {
	// Arrange
	data := map[string]interface{}{
		"matrix": []interface{}{
			[]interface{}{1, 2, 3},
			[]interface{}{4, 5, 6},
			[]interface{}{7, 8, 9},
		},
		"complex": []interface{}{
			map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{"value": 100},
					map[string]interface{}{"value": 200},
				},
			},
		},
	}

	tests := []struct {
		name    string
		path    string
		want    interface{}
		wantErr bool
	}{
		{"2D array access", "matrix[0][0]", 1, false},
		{"2D array middle", "matrix[1][1]", 5, false},
		{"2D array last", "matrix[2][2]", 9, false},
		{"deeply nested with arrays", "complex[0].data[0].value", 100, false},
		{"deeply nested second item", "complex[0].data[1].value", 200, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestGetValueAtPath_ErrorCases_ReturnsError(t *testing.T) {
	// Arrange
	data := map[string]interface{}{
		"items": []interface{}{"a", "b", "c"},
		"nested": map[string]interface{}{
			"value": 42,
		},
	}

	tests := []struct {
		name        string
		path        string
		wantErrMsg  string
	}{
		{"missing property", "nonexistent", "not found"},
		{"missing nested property", "nested.missing", "not found"},
		{"array out of bounds positive", "items[10]", "out of bounds"},
		{"array out of bounds negative", "items[-1]", "out of bounds"},
		{"invalid array notation", "items[", "invalid array notation"},
		{"non-numeric array index", "items[abc]", "invalid array index"},
		{"access property on non-object", "items.name", "not an object"},
		{"array index on non-array", "nested[0]", "not an array"},
		{"empty property name", "nested..value", "empty property name"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			assert.Error(t, err)
			assert.Nil(t, result)
			assert.Contains(t, err.Error(), tt.wantErrMsg)
		})
	}
}

func TestGetValueAtPath_WithProvenance_ExtractsCorrectly(t *testing.T) {
	// Arrange - Data with provenance wrappers
	data := map[string]interface{}{
		"price": map[string]interface{}{
			"value": 100,
			"source": map[string]interface{}{
				"id":   "config-1",
				"name": "Product",
				"type": "PRODUCT",
			},
		},
		"nested": map[string]interface{}{
			"items": []interface{}{
				map[string]interface{}{
					"value": "item1",
					"source": map[string]interface{}{
						"id": "config-2",
					},
				},
			},
		},
	}

	// Act
	result, err := GetValueAtPath(data, "price", false)

	// Assert
	require.NoError(t, err)
	
	// Should return the provenance-wrapped value
	wrapped, ok := result.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, 100, wrapped["value"])
	assert.NotNil(t, wrapped["source"])
}

func TestGetValueAtPath_MinimalMode_UnwrapsProvenance(t *testing.T) {
	// Arrange - Data with provenance wrappers
	data := map[string]interface{}{
		"config": map[string]interface{}{
			"price": map[string]interface{}{
				"value": 150,
				"source": map[string]interface{}{
					"id": "config-1",
				},
			},
			"name": map[string]interface{}{
				"value": "Product",
				"source": map[string]interface{}{
					"id": "config-1",
				},
			},
		},
	}

	// Act - With minimal mode
	result, err := GetValueAtPath(data, "config", true)

	// Assert
	require.NoError(t, err)
	
	// Should return unwrapped values
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)
	
	assert.Equal(t, 150, resultMap["price"])
	assert.Equal(t, "Product", resultMap["name"])
}

func TestGetValueAtPath_ComplexRealWorldPaths_Work(t *testing.T) {
	// Arrange - Realistic configuration data
	data := map[string]interface{}{
		"system": map[string]interface{}{
			"logging": map[string]interface{}{
				"level":  "debug",
				"format": "json",
				"outputs": []interface{}{
					map[string]interface{}{
						"type": "file",
						"path": "/var/log/app.log",
					},
					map[string]interface{}{
						"type": "console",
					},
				},
			},
			"database": map[string]interface{}{
				"connections": []interface{}{
					map[string]interface{}{
						"name": "primary",
						"host": "localhost",
						"port": 5432,
					},
				},
			},
		},
	}

	tests := []struct {
		name string
		path string
		want interface{}
	}{
		{"triple nested", "system.logging.level", "debug"},
		{"array in nested object", "system.logging.outputs[0].type", "file"},
		{"array path property", "system.logging.outputs[0].path", "/var/log/app.log"},
		{"second array item", "system.logging.outputs[1].type", "console"},
		{"database connection", "system.database.connections[0].name", "primary"},
		{"nested port number", "system.database.connections[0].port", 5432},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestUnwrapMinimal_SimpleValues_ReturnsUnwrapped(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  interface{}
	}{
		{
			"wrapped string",
			map[string]interface{}{
				"value":  "test",
				"source": map[string]interface{}{"id": "1"},
			},
			"test",
		},
		{
			"wrapped number",
			map[string]interface{}{
				"value":  42,
				"source": map[string]interface{}{"id": "1"},
			},
			42,
		},
		{
			"unwrapped value",
			"already-unwrapped",
			"already-unwrapped",
		},
		{
			"nil value",
			nil,
			nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := unwrapMinimal(tt.input)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestUnwrapMinimal_NestedObjects_UnwrapsRecursively(t *testing.T) {
	// Arrange
	input := map[string]interface{}{
		"name": map[string]interface{}{
			"value":  "Product",
			"source": map[string]interface{}{"id": "1"},
		},
		"details": map[string]interface{}{
			"price": map[string]interface{}{
				"value":  100,
				"source": map[string]interface{}{"id": "2"},
			},
			"weight": map[string]interface{}{
				"value":  50,
				"source": map[string]interface{}{"id": "1"},
			},
		},
	}

	// Act
	result := unwrapMinimal(input)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, "Product", resultMap["name"])
	
	details, ok := resultMap["details"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, 100, details["price"])
	assert.Equal(t, 50, details["weight"])
}

func TestUnwrapMinimal_Arrays_UnwrapsRecursively(t *testing.T) {
	// Arrange
	input := []interface{}{
		map[string]interface{}{
			"value":  "item1",
			"source": map[string]interface{}{"id": "1"},
		},
		map[string]interface{}{
			"value":  "item2",
			"source": map[string]interface{}{"id": "1"},
		},
		map[string]interface{}{
			"value": map[string]interface{}{
				"nested": "value",
			},
			"source": map[string]interface{}{"id": "1"},
		},
	}

	// Act
	result := unwrapMinimal(input)

	// Assert
	resultArray, ok := result.([]interface{})
	require.True(t, ok)
	require.Len(t, resultArray, 3)

	assert.Equal(t, "item1", resultArray[0])
	assert.Equal(t, "item2", resultArray[1])
	
	nestedMap, ok := resultArray[2].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "value", nestedMap["nested"])
}

func TestUnwrapMinimal_MixedData_UnwrapsCorrectly(t *testing.T) {
	// Arrange - Mixed wrapped and unwrapped data
	input := map[string]interface{}{
		"wrapped": map[string]interface{}{
			"value":  "wrapped-value",
			"source": map[string]interface{}{"id": "1"},
		},
		"unwrapped": "plain-value",
		"array": []interface{}{
			map[string]interface{}{
				"value":  1,
				"source": map[string]interface{}{"id": "1"},
			},
			2, // Plain value
		},
	}

	// Act
	result := unwrapMinimal(input)

	// Assert
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, "wrapped-value", resultMap["wrapped"])
	assert.Equal(t, "plain-value", resultMap["unwrapped"])
	
	arrayResult, ok := resultMap["array"].([]interface{})
	require.True(t, ok)
	assert.Equal(t, 1, arrayResult[0])
	assert.Equal(t, 2, arrayResult[1])
}

func TestMin_CompareIntegers_ReturnsSmaller(t *testing.T) {
	tests := []struct {
		name string
		a    int
		b    int
		want int
	}{
		{"a smaller", 1, 5, 1},
		{"b smaller", 10, 3, 3},
		{"equal", 5, 5, 5},
		{"negative numbers", -5, -3, -5},
		{"zero and positive", 0, 10, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result := min(tt.a, tt.b)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestGetValueAtPath_EdgeCases_HandlesCorrectly(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		path    string
		wantErr bool
	}{
		{
			"empty data",
			map[string]interface{}{},
			"anything",
			true,
		},
		{
			"nil in path",
			map[string]interface{}{"key": nil},
			"key.nested",
			true, // accessing nested on nil should error
		},
		{
			"accessing array element of string",
			map[string]interface{}{"text": "hello"},
			"text[0]",
			true,
		},
		{
			"multiple dots",
			map[string]interface{}{
				"a": map[string]interface{}{
					"b": map[string]interface{}{
						"c": "value",
					},
				},
			},
			"a.b.c",
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(tt.data, tt.path, false)

			// Assert
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}
		})
	}
}

func TestGetValueAtPath_BracketsWithoutDot_WorksCorrectly(t *testing.T) {
	// Arrange
	data := map[string]interface{}{
		"items": []interface{}{
			map[string]interface{}{
				"children": []interface{}{
					"child1", "child2",
				},
			},
		},
	}

	tests := []struct {
		name string
		path string
		want interface{}
	}{
		{"bracket no dot", "items[0]children[0]", "child1"},
		{"bracket with dot", "items[0].children[1]", "child2"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := GetValueAtPath(data, tt.path, false)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.want, result)
		})
	}
}

