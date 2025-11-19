package configs

import (
	"encoding/json"
)

// ProvenanceWrapper represents a value with its source metadata
type ProvenanceWrapper struct {
	Value  interface{} `json:"value"`
	Source SourceInfo  `json:"source"`
}

// SourceInfo contains metadata about where a value came from
type SourceInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	ParentName string `json:"parentName,omitempty"`
	ParentType string `json:"parentType,omitempty"`
	CreatedBy  string `json:"createdBy,omitempty"`
	CreatedAt  string `json:"createdAt,omitempty"`
	UpdatedAt  string `json:"updatedAt,omitempty"`
}

// isProvenanceWrapper checks if a value is a provenance wrapper
func isProvenanceWrapper(v interface{}) bool {
	m, ok := v.(map[string]interface{})
	if !ok {
		return false
	}
	_, hasValue := m["value"]
	_, hasSource := m["source"]
	return hasValue && hasSource && len(m) == 2
}

// extractOriginalSource extracts the source from a provenance-wrapped value
// Returns nil if the value doesn't have provenance
func extractOriginalSource(v interface{}) *SourceInfo {
	if !isProvenanceWrapper(v) {
		return nil
	}
	
	m := v.(map[string]interface{})
	sourceData, ok := m["source"]
	if !ok {
		return nil
	}
	
	// Convert source to SourceInfo
	jsonBytes, err := json.Marshal(sourceData)
	if err != nil {
		return nil
	}
	
	var source SourceInfo
	if err := json.Unmarshal(jsonBytes, &source); err != nil {
		return nil
	}
	
	return &source
}

// extractActualValue recursively unwraps provenance wrappers to get the actual value
func extractActualValue(v interface{}) interface{} {
	for isProvenanceWrapper(v) {
		m := v.(map[string]interface{})
		v = m["value"]
	}
	return v
}

// isPlainObject checks if value is a plain map (not array, not provenance wrapper)
func isPlainObject(v interface{}) bool {
	m, ok := v.(map[string]interface{})
	if !ok {
		return false
	}
	// Check if it's a provenance wrapper
	if isProvenanceWrapper(m) {
		return false
	}
	return true
}

// cloneValue performs a deep clone of a value
func cloneValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	
	// Use JSON marshal/unmarshal for deep clone
	jsonBytes, err := json.Marshal(v)
	if err != nil {
		return v
	}
	
	var result interface{}
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return v
	}
	
	return result
}

// preserveOriginalProvenance preserves existing provenance when inheriting values
// For values that already have provenance, keep it. For new values, add fallback source.
func preserveOriginalProvenance(obj interface{}, fallbackSource SourceInfo, includeProvenance bool) interface{} {
	if !includeProvenance {
		return cloneValue(obj)
	}
	
	if !isPlainObject(obj) {
		// Not a plain object, check if it already has provenance
		if existingSource := extractOriginalSource(obj); existingSource != nil {
			return cloneValue(obj)
		}
		// No provenance, wrap with fallback source
		return map[string]interface{}{
			"value":  cloneValue(obj),
			"source": fallbackSource,
		}
	}
	
	// Plain object - recursively process
	objMap := obj.(map[string]interface{})
	result := make(map[string]interface{})
	
	for key, value := range objMap {
		if isPlainObject(value) {
			// Regular object, recursively process
			result[key] = preserveOriginalProvenance(value, fallbackSource, includeProvenance)
		} else {
			// Check if already has provenance
			if existingSource := extractOriginalSource(value); existingSource != nil {
				// Already has provenance, keep it
				result[key] = cloneValue(value)
			} else {
				// No provenance, add fallback source
				result[key] = map[string]interface{}{
					"value":  cloneValue(value),
					"source": fallbackSource,
				}
			}
		}
	}
	
	return result
}

// addProvenanceToObject wraps all properties in an object with provenance
func addProvenanceToObject(obj interface{}, source SourceInfo, includeProvenance bool) interface{} {
	if !includeProvenance {
		return cloneValue(obj)
	}
	
	if !isPlainObject(obj) {
		return cloneValue(obj)
	}
	
	objMap := obj.(map[string]interface{})
	result := make(map[string]interface{})
	
	for key, value := range objMap {
		if isPlainObject(value) && !isArray(value) {
			// Recursively handle nested objects
			result[key] = addProvenanceToObject(value, source, includeProvenance)
		} else {
			// Wrap primitive values and arrays with provenance
			result[key] = map[string]interface{}{
				"value":  cloneValue(value),
				"source": source,
			}
		}
	}
	
	return result
}

// isArray checks if value is an array
func isArray(v interface{}) bool {
	_, ok := v.([]interface{})
	return ok
}

// deepMergeWithFullProvenance implements the full Node.js provenance logic
func deepMergeWithFullProvenance(base, override map[string]interface{}, baseSource, overrideSource SourceInfo, includeProvenance bool) map[string]interface{} {
	result := make(map[string]interface{})
	
	// Get all keys from both objects
	allKeys := make(map[string]bool)
	for k := range base {
		allKeys[k] = true
	}
	for k := range override {
		allKeys[k] = true
	}
	
	for key := range allKeys {
		baseValue, hasBase := base[key]
		overrideValue, hasOverride := override[key]
		
		var finalValue interface{}
		var finalSource SourceInfo
		
		if hasOverride {
			// Override value exists
			if isPlainObject(overrideValue) && isPlainObject(baseValue) {
				// Both are objects, recursively merge
				finalValue = deepMergeWithFullProvenance(
					baseValue.(map[string]interface{}),
					overrideValue.(map[string]interface{}),
					baseSource,
					overrideSource,
					includeProvenance,
				)
				finalSource = overrideSource
			} else {
				// Override completely replaces base (for primitives and arrays)
				finalValue = cloneValue(overrideValue)
				finalSource = overrideSource
			}
		} else if hasBase {
			// Only base value exists - this is an inherited value
			if isPlainObject(baseValue) {
				// For inherited objects, preserve existing provenance if it exists
				finalValue = preserveOriginalProvenance(baseValue, baseSource, includeProvenance)
			} else {
				finalValue = cloneValue(baseValue)
			}
			// For inherited values, preserve the original source if it already has provenance
			if existingSource := extractOriginalSource(baseValue); existingSource != nil {
				finalSource = *existingSource
			} else {
				finalSource = baseSource
			}
		}
		
		if includeProvenance && finalValue != nil {
			if isPlainObject(finalValue) && !isProvenanceWrapper(finalValue) {
				// This is an object that already has provenance for its children, don't wrap it
				result[key] = finalValue
			} else {
				// Wrap primitive values and arrays with provenance
				result[key] = map[string]interface{}{
					"value":  finalValue,
					"source": finalSource,
				}
			}
		} else {
			result[key] = finalValue
		}
	}
	
	return result
}

