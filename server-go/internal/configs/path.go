package configs

import (
	"fmt"
	"strconv"
	"strings"
)

// GetValueAtPath traverses a nested object using dot notation and array notation
// Supports paths like "system.logging.level" and "items[0].name" and "data[1][2].field"
func GetValueAtPath(data map[string]interface{}, path string, minimal bool) (interface{}, error) {
	if path == "" {
		return data, nil
	}

	current := interface{}(data)
	i := 0
	pathSoFar := ""

	for i < len(path) {
		// Check for array notation [index]
		if i < len(path) && path[i] == '[' {
			// Find closing bracket
			bracketEnd := strings.IndexByte(path[i:], ']')
			if bracketEnd == -1 {
				return nil, fmt.Errorf("invalid array notation in path: %s", path)
			}
			bracketEnd += i

			// Extract index
			indexStr := path[i+1 : bracketEnd]
			index, err := strconv.Atoi(indexStr)
			if err != nil {
				return nil, fmt.Errorf("invalid array index '%s' in path: %s", indexStr, path)
			}

			// Extract actual value from provenance wrapper if needed
			actualCurrent := extractActualValue(current)

			// Check if current is an array
			arr, ok := actualCurrent.([]interface{})
			if !ok {
				return nil, fmt.Errorf("array index %d not valid at path: %s (not an array)", index, pathSoFar)
			}

			if index < 0 || index >= len(arr) {
				return nil, fmt.Errorf("array index %d out of bounds at path: %s (length: %d)", index, pathSoFar, len(arr))
			}

			current = arr[index]
			pathSoFar += fmt.Sprintf("[%d]", index)
			i = bracketEnd + 1

			// Skip optional dot after bracket
			if i < len(path) && path[i] == '.' {
				i++
			}
		} else {
			// Look for next property name
			nextDot := strings.IndexByte(path[i:], '.')
			nextBracket := strings.IndexByte(path[i:], '[')

			// Find the next delimiter
			var nextDelimiter int
			if nextDot != -1 && nextBracket != -1 {
				nextDelimiter = i + min(nextDot, nextBracket)
			} else if nextDot != -1 {
				nextDelimiter = i + nextDot
			} else if nextBracket != -1 {
				nextDelimiter = i + nextBracket
			} else {
				nextDelimiter = len(path)
			}

			// Extract property name
			propName := path[i:nextDelimiter]
			if propName == "" {
				return nil, fmt.Errorf("empty property name in path: %s", path)
			}

			// Extract actual value from provenance wrapper
			actualCurrent := extractActualValue(current)

			// Navigate to property
			obj, ok := actualCurrent.(map[string]interface{})
			if !ok {
				// Check if actualCurrent is nil
				if actualCurrent == nil {
					return nil, fmt.Errorf("cannot access property '%s' on nil value at path: %s", propName, pathSoFar)
				}
				return nil, fmt.Errorf("cannot access property '%s' at path: %s (not an object)", propName, pathSoFar)
			}

			val, exists := obj[propName]
			if !exists {
				return nil, fmt.Errorf("property '%s' not found at path: %s", propName, pathSoFar)
			}

			current = val
			if pathSoFar != "" {
				pathSoFar += "."
			}
			pathSoFar += propName
			i = nextDelimiter

			// Skip dot if present
			if i < len(path) && path[i] == '.' {
				i++
			}
		}
	}

	// If minimal mode, recursively unwrap provenance
	if minimal {
		return unwrapMinimal(current), nil
	}

	return current, nil
}

// unwrapMinimal recursively unwraps provenance wrappers to return pure values
func unwrapMinimal(v interface{}) interface{} {
	// First extract from provenance wrapper
	actual := extractActualValue(v)

	// Then recursively process objects and arrays
	switch val := actual.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{})
		for k, v := range val {
			result[k] = unwrapMinimal(v)
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(val))
		for i, v := range val {
			result[i] = unwrapMinimal(v)
		}
		return result
	default:
		return actual
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

