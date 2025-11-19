package fixtures

import (
	"time"

	"your.module/config-manager/internal/types"
)

// NumericRule returns a numeric validation rule
func NumericRule(configID, path, operator string, value float64) types.Rule {
	return types.Rule{
		ID:              "rule-numeric-" + configID,
		ConfigurationID: configID,
		PropertyPath:    path,
		RuleType:        types.RuleNumeric,
		RuleConfig: map[string]interface{}{
			"operator": operator,
			"value":    value,
		},
		ErrorMessage: "Value does not meet numeric constraint",
		Enabled:      true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// PatternRule returns a pattern (regex) validation rule
func PatternRule(configID, path, pattern string) types.Rule {
	return types.Rule{
		ID:              "rule-pattern-" + configID,
		ConfigurationID: configID,
		PropertyPath:    path,
		RuleType:        types.RulePattern,
		RuleConfig: map[string]interface{}{
			"pattern": pattern,
			"flags":   "",
		},
		ErrorMessage: "Value does not match pattern",
		Enabled:      true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// CollectionRule returns a collection (enum) validation rule
func CollectionRule(configID, path string, validValues []interface{}) types.Rule {
	return types.Rule{
		ID:              "rule-collection-" + configID,
		ConfigurationID: configID,
		PropertyPath:    path,
		RuleType:        types.RuleCollection,
		RuleConfig: map[string]interface{}{
			"validValues": validValues,
		},
		ErrorMessage: "Value not in allowed list",
		Enabled:      true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

